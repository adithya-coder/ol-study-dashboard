/**
 * SchedulingEngine - Core algorithm for distributing study tasks across available days.
 *
 * Responsibilities:
 * - Calculate remaining study days until exam
 * - Distribute lessons evenly across days (max-min difference ≤ 1)
 * - Respect configurable maxPerDay cap
 * - Redistribute missed lessons to next available days
 * - Report capacity status (canFit, overflow)
 * - Prioritize lessons by subject completion and exam weight
 *
 * This module is a pure algorithm module with no dependencies on other app modules.
 */

/**
 * Exam weight numeric values for sorting (higher value = higher priority).
 */
const WEIGHT_ORDER = { high: 3, medium: 2, low: 1 };

/**
 * Get today's date as a Date object at midnight (start of day).
 * @returns {Date}
 */
function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Format a Date object to ISO date string 'YYYY-MM-DD'.
 * @param {Date} date
 * @returns {string}
 */
function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add a number of days to a date and return a new Date.
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const SchedulingEngine = {
  /**
   * Calculate the number of remaining study days from today to the day before the exam.
   * Returns 0 if exam is today, negative if exam is in the past.
   *
   * @param {Date} examDate - The exam date
   * @returns {number} Calendar days from today to day before exam (exclusive of exam day)
   */
  calculateRemainingDays(examDate) {
    const today = getToday();
    const examMidnight = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate());

    // Remaining days = calendar days between today and exam date, exclusive of exam day
    // i.e., days from tomorrow to day before exam = examDate - today - 1 ... 
    // Actually: count of days from today (inclusive) to day before exam (inclusive)
    // = (examDate - today) in days, since we study today but not on exam day
    const diffMs = examMidnight.getTime() - today.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // If exam is today (diffDays = 0) or past (diffDays < 0), return 0 or negative
    if (diffDays <= 0) {
      return diffDays;
    }

    // Available study days: today through day before exam = diffDays days
    return diffDays;
  },

  /**
   * Distribute lessons across remaining days, ensuring:
   * - The difference between the max and min lessons per day is at most 1
   * - No day exceeds maxPerDay
   * - Returns DailyPlan objects with dates starting from tomorrow
   *
   * @param {Array} lessons - Array of lesson objects to distribute
   * @param {number} remainingDays - Number of available study days (D)
   * @param {number} maxPerDay - Maximum lessons allowed per day (M)
   * @returns {Array} Array of DailyPlan objects
   */
  distributeLessons(lessons, remainingDays, maxPerDay) {
    if (remainingDays <= 0 || lessons.length === 0) {
      return [];
    }

    const totalLessons = lessons.length;
    const totalCapacity = remainingDays * maxPerDay;

    // Determine how many lessons we can actually schedule
    const lessonsToSchedule = Math.min(totalLessons, totalCapacity);

    // Calculate base and remainder for even distribution
    const base = Math.floor(lessonsToSchedule / remainingDays);
    const remainder = lessonsToSchedule % remainingDays;

    // Build daily plans starting from today
    const startDate = getToday();
    const plans = [];
    let lessonIndex = 0;

    for (let dayOffset = 0; dayOffset < remainingDays; dayOffset++) {
      const date = addDays(startDate, dayOffset);

      // Days with index < remainder get one extra lesson (ceil distribution)
      let dayCount = base + (dayOffset < remainder ? 1 : 0);

      // Respect maxPerDay cap
      dayCount = Math.min(dayCount, maxPerDay);

      const dayLessons = [];
      for (let i = 0; i < dayCount && lessonIndex < totalLessons; i++) {
        const lesson = lessons[lessonIndex];
        dayLessons.push({
          lessonId: lesson.id,
          subjectId: lesson.subjectId,
          name: lesson.name,
          examWeight: lesson.examWeight,
          completed: false
        });
        lessonIndex++;
      }

      plans.push({
        date: toISODate(date),
        lessons: dayLessons,
        revisionTasks: [],
        totalTasks: dayLessons.length
      });
    }

    return plans;
  },

  /**
   * Reassign missed lessons to the next available days that haven't reached maxPerDay.
   * Modifies and returns the existing plan with missed lessons redistributed.
   *
   * @param {Array} missedLessons - Array of lesson objects that were missed
   * @param {Array} existingPlan - Current DailyPlan array
   * @param {number} maxPerDay - Maximum lessons allowed per day
   * @returns {Array} Updated DailyPlan array
   */
  redistributeMissedLessons(missedLessons, existingPlan, maxPerDay) {
    if (!missedLessons || missedLessons.length === 0) {
      return existingPlan;
    }

    // Work with a copy to avoid mutating the original
    const plan = existingPlan.map(day => ({
      ...day,
      lessons: [...day.lessons],
      revisionTasks: [...day.revisionTasks]
    }));

    // Get today's date to only consider future days
    const today = toISODate(getToday());

    for (const missed of missedLessons) {
      let placed = false;

      // Find the first future day with available capacity
      for (const day of plan) {
        if (day.date <= today) {
          continue; // Skip past and current days
        }

        if (day.lessons.length < maxPerDay) {
          day.lessons.push({
            lessonId: missed.id,
            subjectId: missed.subjectId,
            name: missed.name,
            examWeight: missed.examWeight,
            completed: false
          });
          day.totalTasks = day.lessons.length + day.revisionTasks.length;
          placed = true;
          break;
        }
      }

      // If no existing day has capacity, the lesson remains unplaced (overflow)
      // The caller should check capacity status to handle this case
    }

    // Update totalTasks for all days
    for (const day of plan) {
      day.totalTasks = day.lessons.length + day.revisionTasks.length;
    }

    return plan;
  },

  /**
   * Get the capacity status for scheduling lessons across remaining days.
   *
   * @param {Array} lessons - Array of lesson objects to schedule
   * @param {number} remainingDays - Number of available study days
   * @param {number} maxPerDay - Maximum lessons allowed per day
   * @returns {{ canFit: boolean, totalLessons: number, totalCapacity: number, overflowCount: number }}
   */
  getCapacityStatus(lessons, remainingDays, maxPerDay) {
    const totalLessons = lessons.length;
    const totalCapacity = Math.max(0, remainingDays * maxPerDay);
    const overflowCount = Math.max(0, totalLessons - totalCapacity);
    const canFit = totalLessons <= totalCapacity;

    return {
      canFit,
      totalLessons,
      totalCapacity,
      overflowCount
    };
  },

  /**
   * Prioritize lessons for scheduling based on:
   * 1. Primary: subjects with lower completion percentage first
   * 2. Secondary (within same completion tier): higher exam weight first (high > medium > low)
   *
   * @param {Array} lessons - Array of lesson objects to prioritize
   * @param {Map<string, number>|Object} subjectProgress - Map or object of subjectId → completion percentage (0-100)
   * @returns {Array} Sorted array of lessons (new array, does not mutate input)
   */
  prioritizeLessons(lessons, subjectProgress) {
    if (!lessons || lessons.length === 0) {
      return [];
    }

    // Normalize subjectProgress to a simple lookup function
    const getProgress = (subjectId) => {
      if (subjectProgress instanceof Map) {
        return subjectProgress.get(subjectId) ?? 0;
      }
      return subjectProgress[subjectId] ?? 0;
    };

    // Create a sorted copy
    return [...lessons].sort((a, b) => {
      // Primary sort: lower subject completion percentage first
      const progressA = getProgress(a.subjectId);
      const progressB = getProgress(b.subjectId);

      if (progressA !== progressB) {
        return progressA - progressB;
      }

      // Secondary sort: higher exam weight first
      const weightA = WEIGHT_ORDER[a.examWeight] || 0;
      const weightB = WEIGHT_ORDER[b.examWeight] || 0;

      return weightB - weightA;
    });
  }
};

export default SchedulingEngine;
