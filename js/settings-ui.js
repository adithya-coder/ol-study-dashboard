/**
 * Settings UI Wiring — Data Export/Import
 *
 * Wires up the settings view export/import buttons to StorageEngine methods.
 * Provides file download for export and file selection + validation for import.
 */

import StorageEngine from './storage.js';

/**
 * Show a toast notification. Uses UIRenderer if available globally,
 * otherwise falls back to a simple DOM-based notification.
 * @param {string} message - Notification text
 * @param {'success'|'warning'|'error'} type - Notification type
 */
function showNotification(message, type) {
  // Use UIRenderer if available (loaded by task 12.5)
  if (typeof window.UIRenderer !== 'undefined' && window.UIRenderer.showNotification) {
    window.UIRenderer.showNotification(message, type);
    return;
  }

  // Fallback: create a simple toast notification
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.textContent = message;

  // Styles
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 24px',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    zIndex: '9999',
    maxWidth: '90vw',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    backgroundColor: type === 'success' ? '#43a047' : type === 'error' ? '#e53935' : '#fb8c00'
  });

  document.body.appendChild(toast);

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 4000);
}

/**
 * Handle data export — serialize all app data to a JSON file download.
 */
function handleExport() {
  try {
    const json = StorageEngine.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `ol-study-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();

    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('දත්ත සාර්ථකව නිර්යාත කරන ලදී', 'success');
  } catch (err) {
    showNotification('දත්ත නිර්යාත කිරීම අසාර්ථක විය: ' + err.message, 'error');
  }
}

/**
 * Handle data import — read selected JSON file, validate, and import.
 * @param {Event} event - File input change event
 */
function handleImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    const json = e.target.result;
    const result = StorageEngine.importData(json);

    if (result.success) {
      showNotification('දත්ත සාර්ථකව ආයාත කරන ලදී. යෙදුම නැවත පූරණය වේ...', 'success');
      // Reload app after a short delay to allow notification to show
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      showNotification('ආයාත කිරීම අසාර්ථකයි: ' + (result.error || 'වලංගු නොවන ගොනුවකි'), 'error');
    }
  };

  reader.onerror = function () {
    showNotification('ගොනුව කියවීම අසාර්ථක විය', 'error');
  };

  reader.readAsText(file);

  // Reset file input so the same file can be selected again
  event.target.value = '';
}

/**
 * Initialize settings UI export/import wiring.
 * Binds event listeners to the export button and import file input.
 */
export function initSettingsUI() {
  const exportBtn = document.getElementById('settings-export-btn');
  const importBtn = document.getElementById('settings-import-btn');
  const importFile = document.getElementById('settings-import-file');

  if (exportBtn) {
    exportBtn.addEventListener('click', handleExport);
  }

  if (importBtn && importFile) {
    // Import button triggers the hidden file input
    importBtn.addEventListener('click', () => {
      importFile.click();
    });

    // File input change triggers the import
    importFile.addEventListener('change', handleImport);
  }
}

export default initSettingsUI;
