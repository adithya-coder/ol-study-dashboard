/**
 * EventBus - Simple publish/subscribe module for inter-module communication.
 * 
 * Supported events:
 * - 'lesson:completed'   - { subjectId, lessonId, timestamp }
 * - 'lesson:uncompleted' - { subjectId, lessonId }
 * - 'revision:completed' - { lesson, cycle }
 * - 'plan:recalculated'  - { plan }
 * - 'settings:changed'   - { key, value }
 * - 'storage:error'      - { operation, error }
 * - 'xp:awarded'         - { amount, total }
 * - 'streak:updated'     - { count }
 * - 'badge:earned'       - { badge }
 */

const EventBus = {
  listeners: {},

  /**
   * Subscribe to an event.
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to invoke when event is emitted
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  },

  /**
   * Emit an event, notifying all subscribers.
   * @param {string} event - Event name
   * @param {*} data - Data to pass to each callback
   */
  emit(event, data) {
    if (!this.listeners[event]) {
      return;
    }
    for (const callback of this.listeners[event]) {
      callback(data);
    }
  },

  /**
   * Unsubscribe a specific callback from an event.
   * @param {string} event - Event name
   * @param {Function} callback - The exact callback reference to remove
   */
  off(event, callback) {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }
};

export default EventBus;
