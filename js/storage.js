/**
 * StorageEngine - JSON file-based persistence via API server.
 * All data is stored in data/app-state.json on the server.
 * Falls back to in-memory if API is unavailable.
 */

import EventBus from './event-bus.js';

const API_BASE = '/api/state';

/** In-memory cache of state */
let cachedState = null;

const StorageEngine = {
  isAvailable() {
    return true;
  },

  async loadAllAsync() {
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) return null;
      const data = await res.json();
      cachedState = data;
      return data;
    } catch (err) {
      console.warn('[Storage] API unavailable, using memory:', err.message);
      return cachedState;
    }
  },

  loadAll() {
    return cachedState;
  },

  saveAll(state) {
    cachedState = state;
    fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    }).catch(err => {
      EventBus.emit('storage:error', { operation: 'saveAll', error: err.message });
    });
    return true;
  },

  saveModule(key, data) {
    if (!cachedState) cachedState = {};
    const propName = key.replace('ol_', '');
    cachedState[propName] = data;

    fetch(`/api/module/${propName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(err => {
      EventBus.emit('storage:error', { operation: 'saveModule', error: err.message });
    });
    return true;
  },

  getUsageBytes() {
    return cachedState ? JSON.stringify(cachedState).length * 2 : 0;
  },

  exportData() {
    return JSON.stringify(cachedState || {});
  },

  importData(json) {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: 'Invalid JSON' };
      }
      cachedState = parsed;
      this.saveAll(parsed);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  clear() {
    cachedState = null;
    fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }).catch(() => {});
  }
};

export default StorageEngine;
