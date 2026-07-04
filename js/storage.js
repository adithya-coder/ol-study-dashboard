/**
 * StorageEngine - Per-user JSON persistence via Vercel Blob API.
 * Uses X-User-Id header to scope data per user.
 * Batches saves with debounce to avoid race conditions.
 */

import EventBus from './event-bus.js';

const API_BASE = '/api/state';
let cachedState = null;
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 800;

function getUserId() {
  return sessionStorage.getItem('ol_user_id') || localStorage.getItem('ol_user_id') || 'default';
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': getUserId()
  };
}

/** Perform immediate save of any pending changes */
function saveNow() {
  if (!cachedState || saveTimer === null) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  const body = JSON.stringify(cachedState);
  if (navigator.sendBeacon) {
    const data = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(`${API_BASE}?userId=${getUserId()}`, data);
  } else {
    fetch(API_BASE, {
      method: 'POST',
      headers: getHeaders(),
      body,
      keepalive: true
    }).catch(() => {});
  }
}

/** Schedule a full-state save (debounced to batch rapid updates) */
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (cachedState) {
      fetch(API_BASE, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(cachedState)
      }).catch(err => {
        EventBus.emit('storage:error', { operation: 'save', error: err.message });
      });
    }
  }, SAVE_DEBOUNCE_MS);
}

// Save immediately before page unloads
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', saveNow);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
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
    scheduleSave();
    return true;
  },

  saveModule(key, data) {
    if (!cachedState) cachedState = {};
    const propName = key.replace('ol_', '');
    cachedState[propName] = data;
    scheduleSave();
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
      scheduleSave();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  },

  clear() {
    cachedState = null;
    fetch(API_BASE, { method: 'POST', headers: getHeaders(), body: JSON.stringify({}) }).catch(() => {});
  }
};

export default StorageEngine;
