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
let savesEnabled = false; // Disabled during initialization to prevent data corruption

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
  // Only flush if saves are enabled AND there's a pending timer
  // This prevents init-time state from being written on page close
  if (!savesEnabled || saveTimer === null) return;
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
  if (!savesEnabled) return; // Don't save during initialization
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (cachedState) {
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(cachedState)
        });
        
        if (res.ok) {
          // FIX: After save succeeds, reload the data from server to sync all modules
          // This ensures that if other changes were made on the server, we have the latest state
          const reloadRes = await fetch(API_BASE, { headers: { 'X-User-Id': getUserId() } });
          if (reloadRes.ok) {
            const freshData = await reloadRes.json();
            if (freshData && typeof freshData === 'object') {
              cachedState = freshData;
              // Emit event so modules can reload their state from fresh data
              EventBus.emit('storage:reloaded', { state: freshData });
            }
          }
        }
      } catch (err) {
        EventBus.emit('storage:error', { operation: 'save', error: err.message });
      }
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

  /** Call this after app initialization is complete to enable saves */
  enableSaves() {
    savesEnabled = true;
  },

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
