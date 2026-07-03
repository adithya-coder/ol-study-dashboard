/**
 * GamificationSystem - XP, levels, streaks, and achievement badges.
 *
 * Tracks student progress through experience points awarded for
 * completing lessons and revision tasks. Manages daily study streaks
 * and awards badges for milestones.
 *
 * Events emitted:
 * - 'xp:awarded'     { amount, total }
 * - 'streak:updated' { count }
 * - 'badge:earned'   { badge }
 *
 * Events listened:
 * - 'lesson:completed'   → awardLessonXP() + updateStreak(now)
 * - 'revision:completed' → awardRevisionXP()
 */

import StorageEngine from './storage.js';
import EventBus from './event-bus.js';

/** XP awarded per activity type */
const LESSON_XP = 10;
const REVISION_XP = 5;

/** Badge definitions */
const BADGE_DEFINITIONS = {
  streak_7: {
    id: 'streak_7',
    name: '7-Day Streak',
    description: 'Studied for 7 consecutive days'
  },
  streak_30: {
    id: 'streak_30',
    name: '30-Day Streak',
    description: 'Studied for 30 consecutive days'
  },
  level_5: {
    id: 'level_5',
    name: 'Level 5',
    description: 'Reached Level 5'
  },
  level_10: {
    id: 'level_10',
    name: 'Level 10',
    description: 'Reached Level 10'
  }
};

/**
 * Get an ISO date string (YYYY-MM-DD) from a Date object.
 * @param {Date} date
 * @returns {string}
 */
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Check if two ISO date strings represent consecutive days.
 * @param {string} dateStr1 - Earlier date (ISO)
 * @param {string} dateStr2 - Later date (ISO)
 * @returns {boolean}
 */
function isConsecutiveDay(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1 + 'T00:00:00');
  const d2 = new Date(dateStr2 + 'T00:00:00');
  const diffMs = d2.getTime() - d1.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays === 1;
}

const GamificationSystem = {
  /** @type {number} */
  xp: 0,
  /** @type {number} */
  streak: 0,
  /** @type {string|null} ISO date string */
  lastStudyDate: null,
  /** @type {Array<object>} */
  badges: [],
  /** @type {string[]} ISO date strings */
  studyDates: [],

  /**
   * Initialize the gamification system with optional saved data.
   * @param {object} [savedData] - Previously persisted GamificationState
   */
  initialize(savedData) {
    if (savedData) {
      this.xp = savedData.xp || 0;
      this.streak = savedData.streak || 0;
      this.lastStudyDate = savedData.lastStudyDate || null;
      this.badges = savedData.badges || [];
      this.studyDates = savedData.studyDates || [];
    } else {
      this.xp = 0;
      this.streak = 0;
      this.lastStudyDate = null;
      this.badges = [];
      this.studyDates = [];
    }
  },

  /**
   * Award XP for completing a lesson (+10 XP).
   * Emits 'xp:awarded' with { amount, total }.
   */
  awardLessonXP() {
    this.xp += LESSON_XP;
    this._persist();
    EventBus.emit('xp:awarded', { amount: LESSON_XP, total: this.xp });
  },

  /**
   * Award XP for completing a revision task (+5 XP).
   * Emits 'xp:awarded' with { amount, total }.
   */
  awardRevisionXP() {
    this.xp += REVISION_XP;
    this._persist();
    EventBus.emit('xp:awarded', { amount: REVISION_XP, total: this.xp });
  },

  /**
   * Get the total XP earned.
   * @returns {number}
   */
  getTotalXP() {
    return this.xp;
  },

  /**
   * Get the current level based on XP.
   * Level = floor(xp / 100) + 1
   * @returns {number}
   */
  getLevel() {
    return Math.floor(this.xp / 100) + 1;
  },

  /**
   * Get the current streak count.
   * @returns {number}
   */
  getStreak() {
    return this.streak;
  },

  /**
   * Update the study streak based on the given date.
   *
   * - If lastStudyDate is today → do nothing (already counted)
   * - If lastStudyDate is yesterday → increment streak, add today to studyDates
   * - If lastStudyDate is null or gap ≥ 2 days → reset streak to 1
   *
   * Emits 'streak:updated' with { count }.
   * @param {Date} today - The current date
   */
  updateStreak(today) {
    const todayStr = toISODate(today);

    // Already studied today — no change
    if (this.lastStudyDate === todayStr) {
      return;
    }

    if (this.lastStudyDate && isConsecutiveDay(this.lastStudyDate, todayStr)) {
      // Consecutive day — increment streak
      this.streak += 1;
    } else {
      // First day ever, or gap ≥ 2 days — start new streak
      this.streak = 1;
    }

    // Track the study date
    if (!this.studyDates.includes(todayStr)) {
      this.studyDates.push(todayStr);
    }

    this.lastStudyDate = todayStr;
    this._persist();
    EventBus.emit('streak:updated', { count: this.streak });
  },

  /**
   * Check and award achievement badges based on current app state.
   *
   * Badge conditions:
   * - subject_complete_{subjectId}: All lessons in a subject completed
   * - streak_7: 7-day streak
   * - streak_30: 30-day streak
   * - level_5: Reached Level 5
   * - level_10: Reached Level 10
   * - papers_complete_{subjectId}: All past papers for a subject completed
   *
   * Emits 'badge:earned' for each newly earned badge.
   * @param {object} state - The current AppState
   * @returns {Badge[]} Array of newly earned badges
   */
  checkAchievements(state) {
    const newBadges = [];

    // Check streak badges
    if (this.streak >= 7 && !this._hasBadge('streak_7')) {
      const badge = this._createBadge('streak_7', BADGE_DEFINITIONS.streak_7);
      newBadges.push(badge);
    }
    if (this.streak >= 30 && !this._hasBadge('streak_30')) {
      const badge = this._createBadge('streak_30', BADGE_DEFINITIONS.streak_30);
      newBadges.push(badge);
    }

    // Check level badges
    const level = this.getLevel();
    if (level >= 5 && !this._hasBadge('level_5')) {
      const badge = this._createBadge('level_5', BADGE_DEFINITIONS.level_5);
      newBadges.push(badge);
    }
    if (level >= 10 && !this._hasBadge('level_10')) {
      const badge = this._createBadge('level_10', BADGE_DEFINITIONS.level_10);
      newBadges.push(badge);
    }

    // Check subject completion badges
    if (state && state.syllabus && state.syllabus.subjects) {
      for (const subject of state.syllabus.subjects) {
        const badgeId = `subject_complete_${subject.id}`;
        if (!this._hasBadge(badgeId)) {
          const allCompleted = subject.lessons && subject.lessons.length > 0 &&
            subject.lessons.every(lesson => lesson.completed);
          if (allCompleted) {
            const badge = this._createBadge(badgeId, {
              id: badgeId,
              name: `${subject.name} Complete`,
              description: `Completed all lessons in ${subject.name}`
            });
            newBadges.push(badge);
          }
        }
      }
    }

    // Check past paper completion badges
    if (state && state.pastpapers && state.pastpapers.records) {
      // Group records by subject
      const papersBySubject = {};
      for (const record of state.pastpapers.records) {
        if (!papersBySubject[record.subjectId]) {
          papersBySubject[record.subjectId] = [];
        }
        papersBySubject[record.subjectId].push(record);
      }

      // Check if all papers for each subject are completed
      if (state.syllabus && state.syllabus.subjects) {
        for (const subject of state.syllabus.subjects) {
          const badgeId = `papers_complete_${subject.id}`;
          if (!this._hasBadge(badgeId)) {
            const subjectPapers = papersBySubject[subject.id];
            // A subject has papers complete if it has at least one paper record
            // and all records are marked as completed
            if (subjectPapers && subjectPapers.length > 0 &&
                subjectPapers.every(paper => paper.completed)) {
              const badge = this._createBadge(badgeId, {
                id: badgeId,
                name: `${subject.name} Papers Complete`,
                description: `Completed all past papers for ${subject.name}`
              });
              newBadges.push(badge);
            }
          }
        }
      }
    }

    // Emit events and persist if new badges were earned
    if (newBadges.length > 0) {
      for (const badge of newBadges) {
        this.badges.push(badge);
        EventBus.emit('badge:earned', { badge });
      }
      this._persist();
    }

    return newBadges;
  },

  /**
   * Get the current gamification state for persistence or display.
   * @returns {GamificationState}
   */
  getState() {
    return {
      xp: this.xp,
      streak: this.streak,
      lastStudyDate: this.lastStudyDate,
      badges: [...this.badges],
      studyDates: [...this.studyDates]
    };
  },

  /**
   * Set up event listeners for lesson and revision completion events.
   */
  initListeners() {
    EventBus.on('lesson:completed', () => {
      this.awardLessonXP();
      this.updateStreak(new Date());
    });

    EventBus.on('revision:completed', () => {
      this.awardRevisionXP();
    });
  },

  /**
   * Persist current gamification state to StorageEngine.
   * @private
   */
  _persist() {
    StorageEngine.saveModule('ol_gamification', this.getState());
  },

  /**
   * Check if a badge with the given ID has already been earned.
   * @private
   * @param {string} badgeId
   * @returns {boolean}
   */
  _hasBadge(badgeId) {
    return this.badges.some(b => b.id === badgeId);
  },

  /**
   * Create a badge object with the current date as earnedDate.
   * @private
   * @param {string} id
   * @param {object} definition - Badge definition with name and description
   * @returns {Badge}
   */
  _createBadge(id, definition) {
    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      earnedDate: new Date().toISOString()
    };
  }
};

export default GamificationSystem;
