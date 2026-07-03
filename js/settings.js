/**
 * SettingsModule - Manages user preferences including exam date,
 * daily lesson limit, and dark mode toggle.
 *
 * Persists settings to LocalStorage via StorageEngine.
 * Emits 'settings:changed' events via EventBus when values change.
 */

import StorageEngine from './storage.js';
import EventBus from './event-bus.js';

/** Default settings values used when no saved data exists */
const DEFAULTS = {
  examDate: null,
  maxDailyLessons: 8,
  darkMode: false,
  theme: 'ocean'
};

/** Current in-memory settings state */
let currentSettings = { ...DEFAULTS };

const SettingsModule = {
  /**
   * Initialize settings from StorageEngine.
   * If no saved settings are found, uses defaults.
   */
  initialize(savedSettings) {
    if (savedSettings && typeof savedSettings === 'object') {
      currentSettings = {
        examDate: savedSettings.examDate ?? DEFAULTS.examDate,
        maxDailyLessons: savedSettings.maxDailyLessons ?? DEFAULTS.maxDailyLessons,
        darkMode: savedSettings.darkMode ?? DEFAULTS.darkMode,
        theme: savedSettings.theme ?? DEFAULTS.theme
      };
    } else {
      currentSettings = { ...DEFAULTS };
    }
  },

  /**
   * Get the current settings.
   * @returns {{ examDate: string|null, maxDailyLessons: number, darkMode: boolean, theme: string }}
   */
  getSettings() {
    return { ...currentSettings };
  },

  /**
   * Get default settings values.
   * @returns {{ examDate: null, maxDailyLessons: number, darkMode: boolean, theme: string }}
   */
  getDefaults() {
    return { ...DEFAULTS };
  },

  /**
   * Set the exam date.
   * Validates that the date is in the future (strictly after today).
   * Persists to LocalStorage and emits 'settings:changed'.
   *
   * @param {string|Date} date - The exam date (ISO string or Date object)
   * @returns {{ success: boolean, error?: string }}
   */
  setExamDate(date) {
    // Normalize input to a Date object for validation
    let dateObj;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      return { success: false, error: 'Invalid date format' };
    }

    // Check for invalid date
    if (isNaN(dateObj.getTime())) {
      return { success: false, error: 'Invalid date format' };
    }

    // Validate that the date is strictly in the future (reject today and past)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const examDay = new Date(dateObj);
    examDay.setHours(0, 0, 0, 0);

    if (examDay.getTime() <= today.getTime()) {
      return { success: false, error: 'Exam date must be a future date' };
    }

    // Store as ISO date string
    const dateString = dateObj.toISOString().split('T')[0];
    currentSettings.examDate = dateString;

    // Persist
    this._persist();

    // Emit change event
    EventBus.emit('settings:changed', { key: 'examDate', value: dateString });

    return { success: true };
  },

  /**
   * Set the maximum daily lessons count.
   * Validates that count is an integer in [1, 15].
   * Persists to LocalStorage and emits 'settings:changed'.
   *
   * @param {number} count - The maximum number of daily lessons
   * @returns {{ success: boolean, error?: string }}
   */
  setMaxDailyLessons(count) {
    // Validate type
    if (typeof count !== 'number' || !Number.isInteger(count)) {
      return { success: false, error: 'Maximum daily lessons must be an integer between 1 and 15' };
    }

    // Validate range [1, 15]
    if (count < 1 || count > 15) {
      return { success: false, error: 'Maximum daily lessons must be an integer between 1 and 15' };
    }

    currentSettings.maxDailyLessons = count;

    // Persist
    this._persist();

    // Emit change event
    EventBus.emit('settings:changed', { key: 'maxDailyLessons', value: count });

    return { success: true };
  },

  /**
   * Set dark mode preference.
   * Persists to LocalStorage.
   *
   * @param {boolean} enabled - Whether dark mode should be enabled
   */
  setDarkMode(enabled) {
    const value = Boolean(enabled);
    currentSettings.darkMode = value;

    // Persist
    this._persist();

    // Emit change event
    EventBus.emit('settings:changed', { key: 'darkMode', value });
  },

  /**
   * Set the color theme.
   * Valid themes: ocean, forest, purple, sunset, dark.
   * Persists to LocalStorage and emits 'settings:changed'.
   *
   * @param {string} themeName - The theme identifier
   */
  setTheme(themeName) {
    const validThemes = ['ocean', 'forest', 'purple', 'sunset', 'dark'];
    if (!validThemes.includes(themeName)) {
      themeName = 'ocean';
    }
    currentSettings.theme = themeName;
    // Also sync darkMode based on theme
    currentSettings.darkMode = themeName === 'dark';

    // Persist
    this._persist();

    // Emit change event
    EventBus.emit('settings:changed', { key: 'theme', value: themeName });
  },

  /**
   * Persist current settings to LocalStorage via StorageEngine.
   * @private
   */
  _persist() {
    StorageEngine.saveModule('ol_settings', { ...currentSettings });
  }
};

export default SettingsModule;
