/**
 * SyllabusTracker - Manages syllabus state and lesson completion toggling.
 *
 * Responsibilities:
 * - Initialize syllabus state from saved data or static SYLLABUS_DATA
 * - Track lesson completion with timestamps
 * - Calculate per-subject and overall progress
 * - Query lessons by weight or completion status
 * - Persist state via StorageEngine
 * - Emit events via EventBus on state changes
 */

import { SYLLABUS_DATA } from './syllabus-data.js';
import StorageEngine from './storage.js';
import EventBus from './event-bus.js';

/** @type {{ subjects: Array }} */
let state = { subjects: [] };

const SyllabusTracker = {
  /**
   * Initialize the syllabus tracker.
   * If savedData is provided, restores from it.
   * Otherwise, builds initial state from SYLLABUS_DATA with all lessons incomplete.
   * @param {object} [savedData] - Previously persisted SyllabusState
   */
  initialize(savedData) {
    if (savedData && savedData.subjects && savedData.subjects.length > 0) {
      state = savedData;
    } else {
      state = {
        subjects: SYLLABUS_DATA.map(subject => ({
          id: subject.id,
          name: subject.name,
          lessons: subject.lessons.map(lesson => ({
            id: lesson.id,
            subjectId: subject.id,
            name: lesson.name,
            order: lesson.order,
            examWeight: lesson.examWeight,
            completed: false,
            completedAt: null
          }))
        }))
      };
    }
  },

  /**
   * Mark a lesson as completed, record timestamp, persist, and emit event.
   * @param {string} subjectId
   * @param {string} lessonId
   */
  markCompleted(subjectId, lessonId) {
    const lesson = this._findLesson(subjectId, lessonId);
    if (!lesson) {
      console.warn('[Syllabus] Lesson not found:', subjectId, lessonId);
      return;
    }

    const timestamp = new Date().toISOString();
    lesson.completed = true;
    lesson.completedAt = timestamp;

    console.log('[Syllabus] Marked completed:', subjectId, lessonId);
    StorageEngine.saveModule('ol_syllabus', state);
    EventBus.emit('lesson:completed', { subjectId, lessonId, timestamp });
  },

  /**
   * Mark a lesson as incomplete, clear timestamp, persist, and emit event.
   * @param {string} subjectId
   * @param {string} lessonId
   */
  markIncomplete(subjectId, lessonId) {
    const lesson = this._findLesson(subjectId, lessonId);
    if (!lesson) return;

    lesson.completed = false;
    lesson.completedAt = null;

    StorageEngine.saveModule('ol_syllabus', state);
    EventBus.emit('lesson:uncompleted', { subjectId, lessonId });
  },

  /**
   * Get progress statistics for a single subject.
   * @param {string} subjectId
   * @returns {{ completed: number, total: number, percentage: number }}
   */
  getSubjectProgress(subjectId) {
    const subject = state.subjects.find(s => s.id === subjectId);
    if (!subject) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const total = subject.lessons.length;
    const completed = subject.lessons.filter(l => l.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    return { completed, total, percentage };
  },

  /**
   * Get aggregate progress across all subjects.
   * @returns {{ completed: number, total: number, percentage: number }}
   */
  getOverallProgress() {
    let completed = 0;
    let total = 0;

    for (const subject of state.subjects) {
      total += subject.lessons.length;
      completed += subject.lessons.filter(l => l.completed).length;
    }

    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { completed, total, percentage };
  },

  /**
   * Get all lessons that are not yet completed, across all subjects.
   * @returns {Array} Array of Lesson objects
   */
  getIncompleteLessons() {
    const incomplete = [];
    for (const subject of state.subjects) {
      for (const lesson of subject.lessons) {
        if (!lesson.completed) {
          incomplete.push(lesson);
        }
      }
    }
    return incomplete;
  },

  /**
   * Get all lessons with a specific exam weight, across all subjects.
   * @param {'high' | 'medium' | 'low'} weight
   * @returns {Array} Array of Lesson objects
   */
  getLessonsByWeight(weight) {
    const results = [];
    for (const subject of state.subjects) {
      for (const lesson of subject.lessons) {
        if (lesson.examWeight === weight) {
          results.push(lesson);
        }
      }
    }
    return results;
  },

  /**
   * Get the current syllabus state.
   * @returns {{ subjects: Array }}
   */
  getState() {
    return state;
  },

  /**
   * Find a lesson by subject and lesson ID.
   * @private
   * @param {string} subjectId
   * @param {string} lessonId
   * @returns {object|undefined}
   */
  _findLesson(subjectId, lessonId) {
    const subject = state.subjects.find(s => s.id === subjectId);
    if (!subject) return undefined;
    return subject.lessons.find(l => l.id === lessonId);
  }
};

export default SyllabusTracker;
