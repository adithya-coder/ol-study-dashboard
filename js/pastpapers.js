/**
 * PastPaperTracker - Tracks past paper attempts with scores for all 9 O/L subjects.
 *
 * Covers years 2015-2025 inclusive (11 years per subject).
 * Students can record multiple attempts per paper, each with an optional score (0-100).
 *
 * State is persisted via StorageEngine under 'ol_pastpapers'.
 */

import StorageEngine from './storage.js';

/** Year range for past papers */
const YEAR_START = 2015;
const YEAR_END = 2025;
const TOTAL_YEARS = YEAR_END - YEAR_START + 1; // 11

/** Total number of subjects */
const TOTAL_SUBJECTS = 9;

/** Total possible papers (9 subjects × 11 years) */
const TOTAL_PAPERS = TOTAL_SUBJECTS * TOTAL_YEARS; // 99

const PastPaperTracker = {
  /** @type {{ records: Array<{ subjectId: string, year: number, attempts: Array<{ date: string, score: number|null }> }> }} */
  state: { records: [] },

  /**
   * Initialize the tracker with optional saved data.
   * @param {{ records: Array }} [savedData] - Previously persisted state
   */
  initialize(savedData) {
    if (savedData && Array.isArray(savedData.records)) {
      this.state = { records: savedData.records };
    } else {
      this.state = { records: [] };
    }
  },

  /**
   * Record a past paper attempt for a given subject and year.
   * @param {string} subjectId - The subject identifier
   * @param {number} year - The paper year (2015-2025)
   * @param {number} [score] - Optional score percentage (0-100)
   */
  recordAttempt(subjectId, year, score) {
    const attempt = {
      date: new Date().toISOString(),
      score: (score !== undefined && score !== null) ? score : null
    };

    // Find existing record for this subject/year combo
    let record = this.state.records.find(
      r => r.subjectId === subjectId && r.year === year
    );

    if (record) {
      record.attempts.push(attempt);
    } else {
      this.state.records.push({
        subjectId,
        year,
        attempts: [attempt]
      });
    }

    this._persist();
  },

  /**
   * Get all attempts for a specific subject and year.
   * @param {string} subjectId - The subject identifier
   * @param {number} year - The paper year
   * @returns {Array<{ date: string, score: number|null }>} Array of attempts
   */
  getAttempts(subjectId, year) {
    const record = this.state.records.find(
      r => r.subjectId === subjectId && r.year === year
    );
    return record ? record.attempts : [];
  },

  /**
   * Get the highest non-null score for a subject/year combination.
   * @param {string} subjectId - The subject identifier
   * @param {number} year - The paper year
   * @returns {number|null} The highest score, or null if no scored attempts exist
   */
  getHighestScore(subjectId, year) {
    const attempts = this.getAttempts(subjectId, year);
    const scores = attempts
      .map(a => a.score)
      .filter(s => s !== null);

    if (scores.length === 0) {
      return null;
    }

    return Math.max(...scores);
  },

  /**
   * Get completion stats for a specific subject.
   * A year is considered "completed" if it has at least 1 attempt.
   * @param {string} subjectId - The subject identifier
   * @returns {{ completed: number, total: number }}
   */
  getCompletionBySubject(subjectId) {
    const completedYears = this.state.records.filter(
      r => r.subjectId === subjectId && r.attempts.length > 0
    ).length;

    return {
      completed: completedYears,
      total: TOTAL_YEARS
    };
  },

  /**
   * Get overall completion percentage across all subjects and years.
   * @returns {number} Percentage of distinct subject-year combos attempted (0-100)
   */
  getOverallCompletion() {
    const attemptedPapers = this.state.records.filter(
      r => r.attempts.length > 0
    ).length;

    return (attemptedPapers / TOTAL_PAPERS) * 100;
  },

  /**
   * Get the current state for persistence or external use.
   * @returns {{ records: Array }}
   */
  getState() {
    return this.state;
  },

  /**
   * Persist current state to StorageEngine.
   * @private
   */
  _persist() {
    StorageEngine.saveModule('ol_pastpapers', this.state);
  }
};

export default PastPaperTracker;
