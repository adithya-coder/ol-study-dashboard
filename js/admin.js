/**
 * AdminPanel - Manages syllabus lessons (add/remove) with password protection.
 *
 * Responsibilities:
 * - Authenticate admin user (simple password check)
 * - Render admin UI with subject picker, lesson list, add form
 * - Add new lessons to syllabus dynamically
 * - Remove lessons from syllabus
 * - Persist changes via StorageEngine and update SyllabusTracker state
 */

import SyllabusTracker from './syllabus.js';
import StorageEngine from './storage.js';
import { SYLLABUS_DATA } from './syllabus-data.js';

/** Whether the admin is currently authenticated */
let authenticated = false;

const AdminPanel = {
  /**
   * Check if username and password are correct.
   * @param {string} user
   * @param {string} pass
   * @returns {boolean}
   */
  checkPassword(user, pass) {
    return user === 'admin' && pass === 'admin';
  },

  /**
   * Add a new lesson to a subject in the syllabus.
   * @param {string} subjectId - The subject to add the lesson to
   * @param {string} lessonName - Display name of the lesson
   * @param {'high'|'medium'|'low'} examWeight - Exam weight category
   */
  addLesson(subjectId, lessonName, examWeight) {
    const state = SyllabusTracker.getState();
    const subject = state.subjects.find(s => s.id === subjectId);
    if (!subject) return;

    // Generate a unique lesson ID
    const prefix = subjectId.slice(0, 4);
    const timestamp = Date.now();
    const lessonId = `${prefix}_custom_${timestamp}`;

    // Determine order (append at end)
    const maxOrder = subject.lessons.reduce((max, l) => Math.max(max, l.order || 0), 0);

    const newLesson = {
      id: lessonId,
      subjectId: subjectId,
      name: lessonName,
      order: maxOrder + 1,
      examWeight: examWeight,
      completed: false,
      completedAt: null
    };

    subject.lessons.push(newLesson);

    // Also add to static SYLLABUS_DATA for consistency
    const staticSubject = SYLLABUS_DATA.find(s => s.id === subjectId);
    if (staticSubject) {
      staticSubject.lessons.push({
        id: lessonId,
        name: lessonName,
        order: maxOrder + 1,
        examWeight: examWeight
      });
    }

    // Save state
    StorageEngine.saveModule('ol_syllabus', state);
  },

  /**
   * Remove a lesson from a subject in the syllabus.
   * @param {string} subjectId - The subject to remove the lesson from
   * @param {string} lessonId - The lesson ID to remove
   */
  removeLesson(subjectId, lessonId) {
    const state = SyllabusTracker.getState();
    const subject = state.subjects.find(s => s.id === subjectId);
    if (!subject) return;

    subject.lessons = subject.lessons.filter(l => l.id !== lessonId);

    // Also remove from static SYLLABUS_DATA
    const staticSubject = SYLLABUS_DATA.find(s => s.id === subjectId);
    if (staticSubject) {
      staticSubject.lessons = staticSubject.lessons.filter(l => l.id !== lessonId);
    }

    // Save state
    StorageEngine.saveModule('ol_syllabus', state);
  },

  /**
   * Render the admin panel UI.
   * Shows login form if not authenticated, otherwise shows management UI.
   */
  renderAdminPanel() {
    const container = document.getElementById('admin-content');
    if (!container) return;

    if (!authenticated) {
      this._renderLoginForm(container);
    } else {
      this._renderManagementUI(container);
    }
  },

  /**
   * Initialize the admin panel — wire login form event.
   */
  initialize() {
    this.renderAdminPanel();
  },

  // ─── Private Methods ────────────────────────────────────────────────────

  /**
   * Render the login form.
   * @private
   */
  _renderLoginForm(container) {
    container.innerHTML = `
      <div class="row justify-content-center">
        <div class="col-sm-8 col-md-6 col-lg-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body p-4">
              <div class="text-center mb-4">
                <i class="bi bi-shield-lock fs-1 text-primary"></i>
                <h5 class="fw-bold mt-2">පරිපාලන ප්‍රවේශය</h5>
                <p class="text-muted small">කරුණාකර පරිපාලක අක්තපත්‍ර ඇතුලත් කරන්න</p>
              </div>
              <div id="admin-login-error" class="alert alert-danger d-none" role="alert">
                වැරදි පරිශීලක නාමය හෝ මුරපදය
              </div>
              <div class="mb-3">
                <label for="admin-username" class="form-label">පරිශීලක නාමය</label>
                <input type="text" class="form-control" id="admin-username" placeholder="පරිශීලක නාමය">
              </div>
              <div class="mb-3">
                <label for="admin-password" class="form-label">මුරපදය</label>
                <input type="password" class="form-control" id="admin-password" placeholder="මුරපදය">
              </div>
              <button id="admin-login-btn" class="btn btn-primary w-100">
                <i class="bi bi-box-arrow-in-right me-1"></i>ඇතුල් වන්න
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Wire login button
    const loginBtn = document.getElementById('admin-login-btn');
    const usernameInput = document.getElementById('admin-username');
    const passwordInput = document.getElementById('admin-password');

    const handleLogin = () => {
      const user = usernameInput.value.trim();
      const pass = passwordInput.value;

      if (this.checkPassword(user, pass)) {
        authenticated = true;
        this._renderManagementUI(container);
      } else {
        document.getElementById('admin-login-error').classList.remove('d-none');
      }
    };

    loginBtn.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  },

  /**
   * Render the management UI with subject picker, lesson list, and add form.
   * @private
   */
  _renderManagementUI(container) {
    const state = SyllabusTracker.getState();
    const subjects = state.subjects || [];

    // Build subject options
    const subjectOptions = subjects.map(s =>
      `<option value="${s.id}">${s.name}</option>`
    ).join('');

    container.innerHTML = `
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-transparent">
          <div class="d-flex justify-content-between align-items-center">
            <h6 class="fw-semibold mb-0"><i class="bi bi-pencil-square me-2"></i>පාඩම් කළමනාකරණය</h6>
            <button id="admin-logout-btn" class="btn btn-sm btn-outline-danger">
              <i class="bi bi-box-arrow-right me-1"></i>පිටවන්න
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <label for="admin-subject-select" class="form-label fw-semibold">විෂය තෝරන්න</label>
            <select id="admin-subject-select" class="form-select">
              ${subjectOptions}
            </select>
          </div>
          <div id="admin-lesson-list" class="mb-4"></div>
        </div>
      </div>

      <!-- Add Lesson Form -->
      <div class="card border-0 shadow-sm">
        <div class="card-header bg-transparent">
          <h6 class="fw-semibold mb-0"><i class="bi bi-plus-circle me-2"></i>නව පාඩමක් එකතු කරන්න</h6>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-5">
              <label for="admin-lesson-name" class="form-label">පාඩමේ නම</label>
              <input type="text" class="form-control" id="admin-lesson-name" placeholder="පාඩමේ නම ඇතුලත් කරන්න">
            </div>
            <div class="col-md-4">
              <label for="admin-lesson-weight" class="form-label">විභාග බර</label>
              <select id="admin-lesson-weight" class="form-select">
                <option value="high">ඉහළ (high)</option>
                <option value="medium">මධ්‍යම (medium)</option>
                <option value="low">අඩු (low)</option>
              </select>
            </div>
            <div class="col-md-3 d-flex align-items-end">
              <button id="admin-add-lesson-btn" class="btn btn-success w-100">
                <i class="bi bi-plus-lg me-1"></i>එකතු කරන්න
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Wire events
    this._wireManagementEvents();

    // Render initial subject lessons
    this._renderLessonList();
  },

  /**
   * Wire management UI event handlers.
   * @private
   */
  _wireManagementEvents() {
    // Subject selector change
    const subjectSelect = document.getElementById('admin-subject-select');
    if (subjectSelect) {
      subjectSelect.addEventListener('change', () => {
        this._renderLessonList();
      });
    }

    // Add lesson button
    const addBtn = document.getElementById('admin-add-lesson-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const subjectId = document.getElementById('admin-subject-select').value;
        const lessonName = document.getElementById('admin-lesson-name').value.trim();
        const examWeight = document.getElementById('admin-lesson-weight').value;

        if (!lessonName) {
          alert('කරුණාකර පාඩමේ නම ඇතුලත් කරන්න');
          return;
        }

        this.addLesson(subjectId, lessonName, examWeight);
        document.getElementById('admin-lesson-name').value = '';
        this._renderLessonList();
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        authenticated = false;
        this.renderAdminPanel();
      });
    }
  },

  /**
   * Render the lesson list for the currently selected subject.
   * @private
   */
  _renderLessonList() {
    const listContainer = document.getElementById('admin-lesson-list');
    if (!listContainer) return;

    const subjectId = document.getElementById('admin-subject-select').value;
    const state = SyllabusTracker.getState();
    const subject = state.subjects.find(s => s.id === subjectId);

    if (!subject || subject.lessons.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-3 text-muted">
          <i class="bi bi-inbox fs-4 d-block mb-2"></i>
          මෙම විෂයට පාඩම් නොමැත
        </div>
      `;
      return;
    }

    const weightBadge = {
      high: '<span class="badge bg-danger">ඉහළ</span>',
      medium: '<span class="badge bg-warning text-dark">මධ්‍යම</span>',
      low: '<span class="badge bg-secondary">අඩු</span>'
    };

    let html = '<ul class="list-group list-group-flush">';
    for (const lesson of subject.lessons) {
      html += `
        <li class="list-group-item d-flex align-items-center justify-content-between">
          <div>
            <span class="me-2">${lesson.name}</span>
            ${weightBadge[lesson.examWeight] || ''}
          </div>
          <button class="btn btn-sm btn-outline-danger admin-delete-btn" data-subject="${subjectId}" data-lesson="${lesson.id}" title="මකන්න">
            <i class="bi bi-trash"></i>
          </button>
        </li>
      `;
    }
    html += '</ul>';
    html += `<div class="text-muted small mt-2">මුළු පාඩම්: ${subject.lessons.length}</div>`;

    listContainer.innerHTML = html;

    // Wire delete buttons
    listContainer.querySelectorAll('.admin-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.subject;
        const lid = btn.dataset.lesson;
        if (confirm('ඔබට මෙම පාඩම මැකීමට අවශ්‍ය බව විශ්වාසද?')) {
          this.removeLesson(sid, lid);
          this._renderLessonList();
        }
      });
    });
  }
};

export default AdminPanel;
