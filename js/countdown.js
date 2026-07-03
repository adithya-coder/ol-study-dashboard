/**
 * CountdownTimer - Real-time countdown to the configured exam date.
 *
 * Displays remaining days, hours, minutes, and seconds until midnight
 * of the exam date. Updates every 1 second.
 *
 * Edge cases handled:
 * - No exam date configured → getRemaining() returns null
 * - Exam date reached/passed → isExamStarted() returns true, countdown stops
 */

const CountdownTimer = {
  /** @type {string|null} ISO date string for the exam date */
  _examDate: null,

  /** @type {number|null} setInterval ID */
  _intervalId: null,

  /** @type {Function|null} Optional callback invoked on each tick */
  _onTick: null,

  /**
   * Start the countdown timer for the given exam date.
   * Clears any existing interval before starting a new one.
   * @param {string} examDate - ISO date string (e.g. "2026-12-01")
   * @param {Function} [onTick] - Optional callback invoked every second with the remaining time object or null
   */
  start(examDate, onTick) {
    // Stop any existing timer first
    this.stop();

    this._examDate = examDate || null;
    this._onTick = onTick || null;

    if (!this._examDate) {
      // No exam date — notify callback with null (prompt to set date)
      if (this._onTick) {
        this._onTick(null, { noExamDate: true });
      }
      return;
    }

    // If exam already started, notify and don't start interval
    if (this.isExamStarted()) {
      if (this._onTick) {
        this._onTick(null, { examStarted: true });
      }
      return;
    }

    // Start ticking every 1 second
    this._intervalId = setInterval(() => {
      if (this.isExamStarted()) {
        this.stop();
        if (this._onTick) {
          this._onTick(null, { examStarted: true });
        }
        return;
      }

      const remaining = this.getRemaining();
      if (this._onTick) {
        this._onTick(remaining, null);
      }
    }, 1000);

    // Immediately invoke callback with current remaining time
    const remaining = this.getRemaining();
    if (this._onTick) {
      this._onTick(remaining, null);
    }
  },

  /**
   * Stop the countdown timer and clear the interval.
   */
  stop() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  },

  /**
   * Get the remaining time until midnight of the exam date.
   * @returns {{ days: number, hours: number, minutes: number, seconds: number } | null}
   *   Returns null if no exam date is configured or exam has started.
   */
  getRemaining() {
    if (!this._examDate) {
      return null;
    }

    const now = new Date();
    const examMidnight = this._getExamMidnight();
    const diffMs = examMidnight.getTime() - now.getTime();

    if (diffMs <= 0) {
      return null;
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { days, hours, minutes, seconds };
  },

  /**
   * Check whether the current time has reached or passed midnight of the exam date.
   * @returns {boolean} true if exam period has started (current time ≥ exam midnight)
   */
  isExamStarted() {
    if (!this._examDate) {
      return false;
    }

    const now = new Date();
    const examMidnight = this._getExamMidnight();

    return now.getTime() >= examMidnight.getTime();
  },

  /**
   * Get the Date object representing midnight (00:00:00) of the exam date.
   * @returns {Date}
   * @private
   */
  _getExamMidnight() {
    // Parse the ISO date string and create midnight in local time
    const parts = this._examDate.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day, 0, 0, 0, 0);
  }
};

export default CountdownTimer;
