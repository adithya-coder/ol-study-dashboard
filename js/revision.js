/**
 * RevisionManager - Manages R1/R2/Final revision cycles with scheduling constraints.
 *
 * Scheduling intervals:
 *   R1:    [completionDate + 3, completionDate + 7]
 *   R2:    [R1 completion + 5, R1 completion + 14]
 *   Final: [R2 completion + 7, R2 completion + 21]
 *
 * Constraints:
 *   - Max 5 revision tasks per day
 *   - Total tasks (new lessons + revisions) ≤ maxPerDay
 *   - Priority: subjects below average completion first
 *   - Compression: if insufficient days, compress proportionally (min 1 day between cycles)
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

import StorageEngine from './storage.js';
import EventBus from './event-bus.js';

/** Maximum revision tasks allowed per day */
const MAX_REVISIONS_PER_DAY = 5;

/** Default max daily lesson limit (total tasks including new lessons + revisions) */
const DEFAULT_MAX_PER_DAY = 8;

/** Interval definitions for each cycle [minDays, maxDays] */
const INTERVALS = {
  R1: { min: 3, max: 7 },
  R2: { min: 5, max: 14 },
  Final: { min: 7, max: 21 }
};

/**
 * Utility: format a Date to ISO date string (YYYY-MM-DD).
 * @param {Date} date
 * @returns {string}
 */
function toISODate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Utility: add days to a date.
 * @param {Date|string} date
 * @param {number} days
 * @returns {Date}
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Utility: parse an ISO date string to a Date at midnight.
 * @param {string} isoDate
 * @returns {Date}
 */
function parseDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const RevisionManager = {
  /** @type {{ r1Queue: Array, r2Queue: Array, finalQueue: Array }} */
  state: null,

  /** @type {number} Max total tasks per day (new lessons + revisions) */
  maxPerDay: DEFAULT_MAX_PER_DAY,

  /** @type {Map<string, number>|null} Subject completion percentages for priority */
  subjectCompletions: null,

  /**
   * Initialize the RevisionManager with optional saved state.
   * @param {object} [savedData] - Previously persisted RevisionState
   */
  initialize(savedData) {
    if (savedData && savedData.r1Queue && savedData.r2Queue && savedData.finalQueue) {
      this.state = {
        r1Queue: savedData.r1Queue,
        r2Queue: savedData.r2Queue,
        finalQueue: savedData.finalQueue
      };
    } else {
      this.state = {
        r1Queue: [],
        r2Queue: [],
        finalQueue: []
      };
    }

    // Listen for lesson:completed events to auto-add to R1 queue
    EventBus.on('lesson:completed', (data) => {
      if (data && data.lessonId && data.subjectId) {
        const lesson = { id: data.lessonId, subjectId: data.subjectId };
        const completionDate = data.timestamp ? new Date(data.timestamp) : new Date();
        this.addToR1Queue(lesson, completionDate);
      }
    });
  },

  /**
   * Set subject completion percentages for priority ordering.
   * @param {Map<string, number>|object} completions - Map or object of subjectId -> percentage
   */
  setSubjectCompletions(completions) {
    if (completions instanceof Map) {
      this.subjectCompletions = completions;
    } else if (completions && typeof completions === 'object') {
      this.subjectCompletions = new Map(Object.entries(completions));
    }
  },

  /**
   * Set the maximum daily task limit.
   * @param {number} max
   */
  setMaxPerDay(max) {
    if (typeof max === 'number' && max > 0) {
      this.maxPerDay = max;
    }
  },

  /**
   * Schedule a lesson for R1 revision after completion.
   * Picks the earliest date in [completionDate + 3, completionDate + 7]
   * that doesn't exceed 5 revisions/day.
   *
   * @param {{ id: string, subjectId: string }} lesson
   * @param {Date} completionDate
   */
  addToR1Queue(lesson, completionDate) {
    const scheduledDate = this._findAvailableDate(completionDate, INTERVALS.R1);

    const entry = {
      lessonId: lesson.id,
      subjectId: lesson.subjectId,
      scheduledDate: toISODate(scheduledDate),
      addedDate: toISODate(completionDate),
      completed: false,
      completedDate: null
    };

    this.state.r1Queue.push(entry);
    this._persist();
  },

  /**
   * Mark an R1 revision as complete and move to R2 queue.
   * @param {{ id: string, subjectId?: string }} lesson
   */
  completeR1(lesson) {
    const entry = this.state.r1Queue.find(
      e => e.lessonId === lesson.id && !e.completed
    );

    if (!entry) return;

    const completionDate = new Date();
    entry.completed = true;
    entry.completedDate = toISODate(completionDate);

    // Schedule R2
    const r2Date = this._findAvailableDate(completionDate, INTERVALS.R2);
    const r2Entry = {
      lessonId: entry.lessonId,
      subjectId: entry.subjectId,
      scheduledDate: toISODate(r2Date),
      addedDate: toISODate(completionDate),
      completed: false,
      completedDate: null
    };

    this.state.r2Queue.push(r2Entry);
    this._persist();

    EventBus.emit('revision:completed', { lesson, cycle: 'R1' });
  },

  /**
   * Mark an R2 revision as complete and move to Final queue.
   * @param {{ id: string, subjectId?: string }} lesson
   */
  completeR2(lesson) {
    const entry = this.state.r2Queue.find(
      e => e.lessonId === lesson.id && !e.completed
    );

    if (!entry) return;

    const completionDate = new Date();
    entry.completed = true;
    entry.completedDate = toISODate(completionDate);

    // Schedule Final
    const finalDate = this._findAvailableDate(completionDate, INTERVALS.Final);
    const finalEntry = {
      lessonId: entry.lessonId,
      subjectId: entry.subjectId,
      scheduledDate: toISODate(finalDate),
      addedDate: toISODate(completionDate),
      completed: false,
      completedDate: null
    };

    this.state.finalQueue.push(finalEntry);
    this._persist();

    EventBus.emit('revision:completed', { lesson, cycle: 'R2' });
  },

  /**
   * Mark a Final revision as complete.
   * @param {{ id: string, subjectId?: string }} lesson
   */
  completeFinal(lesson) {
    const entry = this.state.finalQueue.find(
      e => e.lessonId === lesson.id && !e.completed
    );

    if (!entry) return;

    entry.completed = true;
    entry.completedDate = toISODate(new Date());
    this._persist();

    EventBus.emit('revision:completed', { lesson, cycle: 'Final' });
  },

  /**
   * Get all scheduled revision tasks for a given date.
   * Results are ordered by priority: subjects below average completion first.
   *
   * @param {Date} date
   * @returns {Array<{ lesson: { id: string, subjectId: string }, cycle: string, scheduledDate: Date, completed: boolean }>}
   */
  getScheduledRevisions(date) {
    const dateStr = toISODate(date);
    const tasks = [];

    // Gather from R1 queue
    for (const entry of this.state.r1Queue) {
      if (entry.scheduledDate === dateStr && !entry.completed) {
        tasks.push({
          lesson: { id: entry.lessonId, subjectId: entry.subjectId },
          cycle: 'R1',
          scheduledDate: parseDate(entry.scheduledDate),
          completed: entry.completed
        });
      }
    }

    // Gather from R2 queue
    for (const entry of this.state.r2Queue) {
      if (entry.scheduledDate === dateStr && !entry.completed) {
        tasks.push({
          lesson: { id: entry.lessonId, subjectId: entry.subjectId },
          cycle: 'R2',
          scheduledDate: parseDate(entry.scheduledDate),
          completed: entry.completed
        });
      }
    }

    // Gather from Final queue
    for (const entry of this.state.finalQueue) {
      if (entry.scheduledDate === dateStr && !entry.completed) {
        tasks.push({
          lesson: { id: entry.lessonId, subjectId: entry.subjectId },
          cycle: 'Final',
          scheduledDate: parseDate(entry.scheduledDate),
          completed: entry.completed
        });
      }
    }

    // Sort by priority: subjects below average completion first
    return this._sortByPriority(tasks);
  },

  /**
   * Get the count of revision tasks scheduled for a given date.
   * Enforces max 5 revision tasks per day.
   *
   * @param {Date} date
   * @returns {number}
   */
  getDailyRevisionCount(date) {
    const dateStr = toISODate(date);
    let count = 0;

    for (const entry of this.state.r1Queue) {
      if (entry.scheduledDate === dateStr) count++;
    }
    for (const entry of this.state.r2Queue) {
      if (entry.scheduledDate === dateStr) count++;
    }
    for (const entry of this.state.finalQueue) {
      if (entry.scheduledDate === dateStr) count++;
    }

    return count;
  },

  /**
   * Compress intervals if insufficient days remain before the exam.
   * Proportionally reduces intervals while maintaining min 1 day between cycles.
   *
   * @param {Date} examDate
   */
  compressIntervalsIfNeeded(examDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const examDay = new Date(examDate);
    examDay.setHours(0, 0, 0, 0);

    const totalDaysRemaining = Math.max(0, Math.floor((examDay - today) / (1000 * 60 * 60 * 24)));

    // Full intervals sum: R1 min(3) + R2 min(5) + Final min(7) = 15 days minimum
    const fullMinSum = INTERVALS.R1.min + INTERVALS.R2.min + INTERVALS.Final.min;

    if (totalDaysRemaining >= fullMinSum) {
      // Enough days, no compression needed
      return;
    }

    if (totalDaysRemaining <= 3) {
      // Very few days: set all to 1 day minimum
      this._rescheduleAllPending(1, 1, 1, today);
      return;
    }

    // Compress proportionally
    // Total minimum cycle intervals = 3 (one for each gap between cycles)
    // Distribute remaining days proportionally among the 3 intervals
    const availableForIntervals = totalDaysRemaining;
    const totalWeight = INTERVALS.R1.min + INTERVALS.R2.min + INTERVALS.Final.min;

    let r1Interval = Math.max(1, Math.round((INTERVALS.R1.min / totalWeight) * availableForIntervals));
    let r2Interval = Math.max(1, Math.round((INTERVALS.R2.min / totalWeight) * availableForIntervals));
    let finalInterval = Math.max(1, Math.round((INTERVALS.Final.min / totalWeight) * availableForIntervals));

    // Ensure total doesn't exceed available days
    while (r1Interval + r2Interval + finalInterval > totalDaysRemaining) {
      if (finalInterval > 1) finalInterval--;
      else if (r2Interval > 1) r2Interval--;
      else if (r1Interval > 1) r1Interval--;
      else break;
    }

    this._rescheduleAllPending(r1Interval, r2Interval, finalInterval, today);
    this._persist();
  },

  /**
   * Get the current state for persistence.
   * @returns {{ r1Queue: Array, r2Queue: Array, finalQueue: Array }}
   */
  getState() {
    return {
      r1Queue: [...this.state.r1Queue],
      r2Queue: [...this.state.r2Queue],
      finalQueue: [...this.state.finalQueue]
    };
  },

  // --- Private Methods ---

  /**
   * Find the earliest available date within the given interval
   * that doesn't exceed MAX_REVISIONS_PER_DAY.
   *
   * @param {Date} baseDate - The reference date to offset from
   * @param {{ min: number, max: number }} interval - Min/max days offset
   * @returns {Date}
   */
  _findAvailableDate(baseDate, interval) {
    const base = new Date(baseDate);
    base.setHours(0, 0, 0, 0);

    for (let offset = interval.min; offset <= interval.max; offset++) {
      const candidate = addDays(base, offset);
      const count = this.getDailyRevisionCount(candidate);

      if (count < MAX_REVISIONS_PER_DAY) {
        return candidate;
      }
    }

    // If all dates in the interval are full, use the last date in range
    // (overflow scenario - still schedule it to not lose the revision)
    return addDays(base, interval.max);
  },

  /**
   * Sort revision tasks by priority: subjects below average completion percentage first.
   * @param {Array} tasks
   * @returns {Array}
   */
  _sortByPriority(tasks) {
    if (!this.subjectCompletions || this.subjectCompletions.size === 0) {
      return tasks;
    }

    // Calculate average completion
    let total = 0;
    let count = 0;
    for (const pct of this.subjectCompletions.values()) {
      total += pct;
      count++;
    }
    const average = count > 0 ? total / count : 0;

    // Sort: below-average subjects first, then by cycle priority (R1 > R2 > Final)
    const cyclePriority = { R1: 0, R2: 1, Final: 2 };

    return tasks.sort((a, b) => {
      const aCompletion = this.subjectCompletions.get(a.lesson.subjectId) ?? 0;
      const bCompletion = this.subjectCompletions.get(b.lesson.subjectId) ?? 0;

      const aBelowAvg = aCompletion < average ? 0 : 1;
      const bBelowAvg = bCompletion < average ? 0 : 1;

      if (aBelowAvg !== bBelowAvg) {
        return aBelowAvg - bBelowAvg;
      }

      // Secondary sort: by cycle priority
      return (cyclePriority[a.cycle] || 0) - (cyclePriority[b.cycle] || 0);
    });
  },

  /**
   * Reschedule all pending (incomplete) entries with compressed intervals.
   *
   * @param {number} r1Interval - Compressed R1 interval in days
   * @param {number} r2Interval - Compressed R2 interval in days
   * @param {number} finalInterval - Compressed Final interval in days
   * @param {Date} today - Current date reference
   */
  _rescheduleAllPending(r1Interval, r2Interval, finalInterval, today) {
    const todayStr = toISODate(today);

    // Reschedule pending R1 entries
    for (const entry of this.state.r1Queue) {
      if (!entry.completed) {
        const baseDate = parseDate(entry.addedDate);
        const newDate = addDays(baseDate, r1Interval);
        // Don't schedule in the past
        if (toISODate(newDate) < todayStr) {
          entry.scheduledDate = todayStr;
        } else {
          entry.scheduledDate = toISODate(newDate);
        }
      }
    }

    // Reschedule pending R2 entries
    for (const entry of this.state.r2Queue) {
      if (!entry.completed) {
        const baseDate = parseDate(entry.addedDate);
        const newDate = addDays(baseDate, r2Interval);
        if (toISODate(newDate) < todayStr) {
          entry.scheduledDate = todayStr;
        } else {
          entry.scheduledDate = toISODate(newDate);
        }
      }
    }

    // Reschedule pending Final entries
    for (const entry of this.state.finalQueue) {
      if (!entry.completed) {
        const baseDate = parseDate(entry.addedDate);
        const newDate = addDays(baseDate, finalInterval);
        if (toISODate(newDate) < todayStr) {
          entry.scheduledDate = todayStr;
        } else {
          entry.scheduledDate = toISODate(newDate);
        }
      }
    }
  },

  /**
   * Persist current state to StorageEngine.
   */
  _persist() {
    StorageEngine.saveModule('ol_revision', this.state);
  }
};

export default RevisionManager;
