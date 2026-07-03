/**
 * StudyPlanner - Generates and manages the daily study plan.
 *
 * Responsibilities:
 * - Generate a daily plan by distributing incomplete lessons across remaining days
 * - Recalculate plan when lessons are completed or settings change
 * - Provide today's plan entry
 * - Handle missed days via redistribution
 * - Warn when capacity is exceeded
 * - Listen for lesson:completed and settings:changed events
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 15.2, 15.3, 18.4
 */

import SchedulingEngine from './scheduler.js';
import StorageEngine from './storage.js';
import EventBus from './event-bus.js';
import SyllabusTracker from './syllabus.js';
import PastPaperTracker from './pastpapers.js';

/** @type {Array} The current daily plan */
let currentPlan = [];

/** @type {object|null} Cached settings reference */
let currentSettings = null;

/**
 * Get today's date as 'YYYY-MM-DD' string.
 * @returns {string}
 */
function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Build a subject progress map from the current syllabus state.
 * @param {object} syllabusState - { subjects: Array }
 * @returns {Object<string, number>} subjectId → completion percentage
 */
function buildSubjectProgress(syllabusState) {
  const progress = {};
  for (const subject of syllabusState.subjects) {
    const total = subject.lessons.length;
    const completed = subject.lessons.filter(l => l.completed).length;
    progress[subject.id] = total === 0 ? 0 : Math.round((completed / total) * 100);
  }
  return progress;
}

const StudyPlanner = {
  /**
   * Generate a daily study plan from syllabus state and settings.
   * Gets incomplete lessons, prioritizes them, distributes across remaining days,
   * persists the plan, and emits 'plan:recalculated'.
   *
   * Edge cases:
   * - If examDate is null/undefined → return empty plan (prompt user to set date)
   * - If exam date has passed or is today → return empty plan
   * - If zero remaining days → return empty plan
   *
   * @param {object} syllabusState - { subjects: [{ id, name, lessons: [...] }] }
   * @param {object} settings - { examDate, maxDailyLessons, darkMode }
   * @returns {Array} Array of DailyPlan objects
   */
  generatePlan(syllabusState, settings) {
    currentSettings = settings;

    // Edge case: no exam date set
    if (!settings || !settings.examDate) {
      currentPlan = [];
      StorageEngine.saveModule('ol_plan', currentPlan);
      return currentPlan;
    }

    // Parse exam date
    const examDate = new Date(settings.examDate);
    if (isNaN(examDate.getTime())) {
      currentPlan = [];
      StorageEngine.saveModule('ol_plan', currentPlan);
      return currentPlan;
    }

    // Calculate remaining days
    const remainingDays = SchedulingEngine.calculateRemainingDays(examDate);
    if (remainingDays <= 0) {
      currentPlan = [];
      StorageEngine.saveModule('ol_plan', currentPlan);
      return currentPlan;
    }

    const maxPerDay = settings.maxDailyLessons || 8;

    // ═══ SMART SCHEDULING ═══
    // Strategy: Balance subjects across days so student covers all subjects evenly.
    // Priority: weakest subjects first, high exam weight first within each subject.
    // Mix subjects per day (2-3 subjects per day for variety, not all from one subject).

    // Group incomplete lessons by subject
    const subjectLessons = {};
    for (const subject of syllabusState.subjects) {
      const incomplete = subject.lessons.filter(l => !l.completed);
      if (incomplete.length > 0) {
        subjectLessons[subject.id] = {
          name: subject.name,
          lessons: incomplete.sort((a, b) => {
            // High weight first within same subject
            const weightOrder = { high: 0, medium: 1, low: 2 };
            return (weightOrder[a.examWeight] || 2) - (weightOrder[b.examWeight] || 2);
          })
        };
      }
    }

    const subjectIds = Object.keys(subjectLessons);
    if (subjectIds.length === 0) {
      currentPlan = [];
      StorageEngine.saveModule('ol_plan', currentPlan);
      EventBus.emit('plan:recalculated', { plan: currentPlan });
      return currentPlan;
    }

    // Sort subjects by: most incomplete lessons first (weakest subjects get more time)
    const subjectProgress = buildSubjectProgress(syllabusState);
    subjectIds.sort((a, b) => (subjectProgress[a] || 0) - (subjectProgress[b] || 0));

    // Build day-by-day plan using round-robin across subjects
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const plans = [];

    // Track how many lessons consumed per subject
    const subjectIndex = {};
    for (const id of subjectIds) {
      subjectIndex[id] = 0;
    }

    for (let dayOffset = 0; dayOffset < remainingDays; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      const dayLessons = [];
      let slotsLeft = maxPerDay;

      // Round-robin: cycle through subjects, picking 1-2 lessons per subject per day
      for (let round = 0; round < Math.ceil(maxPerDay / subjectIds.length) + 1; round++) {
        for (const subId of subjectIds) {
          if (slotsLeft <= 0) break;

          const lessons = subjectLessons[subId].lessons;
          const idx = subjectIndex[subId];

          if (idx < lessons.length) {
            const lesson = lessons[idx];
            dayLessons.push({
              lessonId: lesson.id,
              subjectId: lesson.subjectId || subId,
              name: lesson.name,
              examWeight: lesson.examWeight,
              completed: false
            });
            subjectIndex[subId]++;
            slotsLeft--;
          }
        }
        if (slotsLeft <= 0) break;
      }

      plans.push({
        date: dateStr,
        lessons: dayLessons,
        revisionTasks: [],
        paperSessions: [],
        totalTasks: dayLessons.length
      });

      // Check if all lessons are scheduled
      const allDone = subjectIds.every(id => subjectIndex[id] >= subjectLessons[id].lessons.length);
      if (allDone) break;
    }

    // ═══ PAPER SCHEDULING ═══
    // Reserve the last 20% of remaining days for past papers (after lesson days)
    // Schedule 2 papers per day, cycling through subjects
    const lessonDaysCount = plans.length;
    const paperDays = Math.max(5, Math.floor(remainingDays * 0.2)); // At least 5 days for papers
    const paperStartOffset = lessonDaysCount; // Papers start after all lessons are scheduled

    // Get list of unattempted papers (subject + year combos not yet attempted)
    const unattemptedPapers = [];
    for (const subject of syllabusState.subjects) {
      for (let year = 2015; year <= 2025; year++) {
        const attempts = PastPaperTracker.getAttempts(subject.id, year);
        if (attempts.length === 0) {
          unattemptedPapers.push({
            subjectId: subject.id,
            subjectName: subject.name,
            year: year
          });
        }
      }
    }

    // Schedule papers into plan days
    if (unattemptedPapers.length > 0) {
      let paperIdx = 0;
      const papersPerDay = 2;

      for (let d = 0; d < paperDays && paperIdx < unattemptedPapers.length; d++) {
        const dayOffset = paperStartOffset + d;
        const date = new Date(today);
        date.setDate(date.getDate() + dayOffset);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const paperSessions = [];
        for (let p = 0; p < papersPerDay && paperIdx < unattemptedPapers.length; p++) {
          paperSessions.push(unattemptedPapers[paperIdx]);
          paperIdx++;
        }

        // Check if this day already exists in plans
        const existingDay = plans.find(plan => plan.date === dateStr);
        if (existingDay) {
          existingDay.paperSessions = paperSessions;
          existingDay.totalTasks += paperSessions.length;
        } else {
          plans.push({
            date: dateStr,
            lessons: [],
            revisionTasks: [],
            paperSessions: paperSessions,
            totalTasks: paperSessions.length
          });
        }
      }
    }

    // Sort plans by date
    plans.sort((a, b) => a.date.localeCompare(b.date));

    currentPlan = plans;
    StorageEngine.saveModule('ol_plan', currentPlan);
    EventBus.emit('plan:recalculated', { plan: currentPlan });
    return currentPlan;
  },

  /**
   * Recalculate the plan from current incomplete lessons and current settings.
   * Used when a lesson is completed or settings change (Req 3.3).
   *
   * @returns {Array} Updated array of DailyPlan objects
   */
  recalculate() {
    const syllabusState = SyllabusTracker.getState();
    const settings = currentSettings || { examDate: null, maxDailyLessons: 8 };
    const todayStr = getTodayISO();

    // Preserve today's plan — just update completion status
    const todayPlan = currentPlan.find(d => d.date === todayStr);

    if (todayPlan) {
      // Update completion status of today's lessons based on syllabus state
      for (const planned of todayPlan.lessons) {
        const subject = syllabusState.subjects.find(s => s.id === planned.subjectId);
        if (subject) {
          const lesson = subject.lessons.find(l => l.id === planned.lessonId);
          if (lesson) {
            planned.completed = lesson.completed;
          }
        }
      }

      // Regenerate the full plan
      const newPlan = this.generatePlan(syllabusState, settings);

      // Replace today's entry in the new plan with the preserved one
      const todayIdx = newPlan.findIndex(d => d.date === todayStr);
      if (todayIdx >= 0) {
        newPlan[todayIdx] = todayPlan;
      } else {
        // Today wasn't in new plan (all lessons done), add it anyway for display
        newPlan.unshift(todayPlan);
        newPlan.sort((a, b) => a.date.localeCompare(b.date));
      }

      currentPlan = newPlan;
      StorageEngine.saveModule('ol_plan', currentPlan);
      EventBus.emit('plan:recalculated', { plan: currentPlan });
      return currentPlan;
    }

    // No existing today plan — do full regeneration
    return this.generatePlan(syllabusState, settings);
  },

  /**
   * Get today's DailyPlan entry from the current plan.
   *
   * @returns {object|null} Today's DailyPlan or null if not found
   */
  getTodaysPlan() {
    const today = getTodayISO();
    const entry = currentPlan.find(day => day.date === today);
    return entry || null;
  },

  /**
   * Handle a missed day by redistributing its incomplete lessons (Req 3.4).
   * Finds lessons for the given date that are not completed,
   * and redistributes them to future days with available capacity.
   *
   * @param {string} date - ISO date string 'YYYY-MM-DD'
   */
  markDayComplete(date) {
    const dayEntry = currentPlan.find(day => day.date === date);
    if (!dayEntry) {
      return;
    }

    // Find lessons that were not completed for that day
    const missedLessons = dayEntry.lessons
      .filter(l => !l.completed)
      .map(l => ({
        id: l.lessonId,
        subjectId: l.subjectId,
        name: l.name,
        examWeight: l.examWeight
      }));

    if (missedLessons.length === 0) {
      return;
    }

    const maxPerDay = (currentSettings && currentSettings.maxDailyLessons) || 8;

    // Redistribute missed lessons to future days
    currentPlan = SchedulingEngine.redistributeMissedLessons(missedLessons, currentPlan, maxPerDay);

    // Persist updated plan
    StorageEngine.saveModule('ol_plan', currentPlan);
    EventBus.emit('plan:recalculated', { plan: currentPlan });
  },

  /**
   * Check if the current plan exceeds capacity (Req 3.5).
   * Returns a warning message string if capacity is exceeded, null otherwise.
   *
   * @returns {string|null} Warning message or null
   */
  getOverloadWarning() {
    if (!currentSettings || !currentSettings.examDate) {
      return null;
    }

    const examDate = new Date(currentSettings.examDate);
    if (isNaN(examDate.getTime())) {
      return null;
    }

    const remainingDays = SchedulingEngine.calculateRemainingDays(examDate);
    if (remainingDays <= 0) {
      return null;
    }

    const maxPerDay = currentSettings.maxDailyLessons || 8;
    const incompleteLessons = SyllabusTracker.getIncompleteLessons();

    const status = SchedulingEngine.getCapacityStatus(incompleteLessons, remainingDays, maxPerDay);

    if (!status.canFit) {
      return `පාඩම් ගණන (${status.totalLessons}) ඉතිරි දින ${remainingDays} × දිනකට උපරිම ${maxPerDay} = ${status.totalCapacity} ධාරිතාව ඉක්මවයි. පාඩම් ${status.overflowCount}ක් විභාගයට පෙර සම්පූර්ණ කිරීමට නොහැක.`;
    }

    return null;
  },

  /**
   * Get the current plan array.
   * @returns {Array}
   */
  getPlan() {
    return currentPlan;
  },

  /**
   * Set the current plan (e.g. when loading from storage).
   * @param {Array} plan
   */
  setPlan(plan) {
    currentPlan = Array.isArray(plan) ? plan : [];
  },

  /**
   * Set the current settings reference.
   * @param {object} settings
   */
  setSettings(settings) {
    currentSettings = settings;
  },

  /**
   * Initialize event listeners for auto-recalculation.
   * Listens for 'lesson:completed' and 'settings:changed' events.
   */
  initListeners() {
    EventBus.on('lesson:completed', () => {
      this.recalculate();
    });

    EventBus.on('settings:changed', (data) => {
      // Update cached settings if relevant keys changed
      if (data && (data.key === 'examDate' || data.key === 'maxDailyLessons')) {
        if (currentSettings) {
          currentSettings[data.key] = data.value;
        }
        this.recalculate();
      }
    });
  }
};

export default StudyPlanner;
