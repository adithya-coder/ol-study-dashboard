/**
 * StorageEngine - Per-user JSON persistence via Vercel Blob API.
 * Uses X-User-Id header to scope data per user.
 */

import EventBus from './event-bus.js';

const API_BASE = '/api/state';
let cachedState = null;

// Get current user ID from session storage
function getUserId() {
  return sessionStorage.getItem('ol_user_id') || 'default';
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': getUserId()
  };
}

const StorageEngine = {
  isAvailable() { return true; },

  async loadAllAsync() {
    try {
      const res = await fetch(API_BASE, { headers: { 'X-User-Id': getUserId() } });
      if (!res.ok) return null;
      const data = await res.json();
      cachedState = data;
      return data;
    } catch (err) {
      console.warn('[Storage] API unavailable:', err.message);
      return cachedState;
    }
  },

  loadAll() { return cachedState; },

  saveAll(state) {
    cachedState = state;
    fetch(API_BASE, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(state)
    }).catch(err => EventBus.emit('storage:error', { operation: 'saveAll', error: err.message }));
    return true;
  },

  saveModule(key, data) {
    if (!cachedState) cachedState = {};
    const propName = key.replace('ol_', '');
    cachedState[propName] = data;

    fetch(`${API_BASE}?key=${propName}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    }).catch(err => EventBus.emit('storage:error', { operation: 'saveModule', error: err.message }));
    return true;
  },

  getUsageBytes() {
    return cachedState ? JSON.stringify(cachedState).length * 2 : 0;
  },

  exportData() { return JSON.stringify(cachedState || {}); },

  importData(json) {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') return { success: false, error: 'Invalid JSON' };
      cachedState = parsed;
      this.saveAll(parsed);
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  },

  clear() {
    cachedState = null;
    fetch(API_BASE, { method: 'POST', headers: getHeaders(), body: JSON.stringify({}) }).catch(() => {});
  }
};

export default StorageEngine;
