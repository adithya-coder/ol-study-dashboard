/**
 * UIRenderer - Handles all DOM manipulation and rendering.
 *
 * Uses Bootstrap 5 components and utility classes for all UI rendering.
 *
 * Provides methods for:
 * - Loading/error overlays
 * - Toast notifications (Bootstrap Toast component)
 * - Dashboard rendering (XP, level, streak, badges, countdown, today's plan)
 * - Subject cards with progress bars and lesson checkboxes
 * - Daily plan rendering with exam weight labels and completion toggles
 * - Progress rendering with Chart.js charts
 * - Dark mode toggling (Bootstrap data-bs-theme)
 * - View navigation (show/hide sections)
 *
 * Requirements: 2.3, 4.1, 4.2, 4.3, 4.4, 4.5, 8.7, 9.5, 9.6, 18.4, 21.3, 21.4
 */

import EventBus from './event-bus.js';
import SyllabusTracker from './syllabus.js';

/** Auto-dismiss delay for info/warning notifications (ms) */
const NOTIFICATION_DISMISS_MS = 5000;

/** View IDs mapped to their section element IDs */
const VIEW_SECTIONS = {
  dashboard: 'view-dashboard',
  syllabus: 'view-syllabus',
  planner: 'view-planner',
  progress: 'view-progress',
  revision: 'view-revision',
  'past-papers': 'view-past-papers',
  analytics: 'view-analytics',
  settings: 'view-settings',
  admin: 'view-admin'
};

/** Exam weight display labels (Sinhala) */
const WEIGHT_LABELS = {
  high: 'ඉහළ',
  medium: 'මධ්‍යම',
  low: 'අඩු'
};

/** Bootstrap badge color classes for exam weights */
const WEIGHT_BADGE_CLASSES = {
  high: 'bg-danger',
  medium: 'bg-warning text-dark',
  low: 'bg-secondary'
};

const UIRenderer = {
  /**
   * Show the loading overlay during initialization (Req 21.3).
   */
  showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
    }
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'none';
    }
  },

  /**
   * Hide the loading overlay and show the app (Req 21.4).
   */
  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    const app = document.getElementById('app');
    if (app) {
      app.style.display = '';
    }
  },

  /**
   * Show error overlay with message and retry button (Req 21.4).
   * @param {string} message - Error description to display
   * @param {Function} retryFn - Callback invoked when retry button is clicked
   */
  showError(message, retryFn) {
    const overlay = document.getElementById('error-overlay');
    const messageEl = document.getElementById('error-message');
    const retryBtn = document.getElementById('error-retry-btn');

    if (messageEl) {
      messageEl.textContent = message;
    }

    if (retryBtn) {
      const newBtn = retryBtn.cloneNode(true);
      retryBtn.parentNode.replaceChild(newBtn, retryBtn);
      newBtn.addEventListener('click', () => {
        if (overlay) overlay.style.display = 'none';
        if (typeof retryFn === 'function') retryFn();
      });
    }

    if (overlay) {
      overlay.style.display = 'flex';
    }

    // Hide loading overlay if visible
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
  },

  /**
   * Show a toast notification using Bootstrap Toast component (Req 2.3).
   * Info and warning auto-dismiss after 5 seconds.
   * Error notifications persist until manually dismissed.
   * @param {string} message - Notification text
   * @param {string} type - 'success' | 'info' | 'warning' | 'error'
   */
  showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const colorMap = {
      success: 'text-bg-success',
      info: 'text-bg-info',
      warning: 'text-bg-warning',
      error: 'text-bg-danger'
    };

    const iconMap = {
      success: 'bi-check-circle-fill',
      info: 'bi-info-circle-fill',
      warning: 'bi-exclamation-triangle-fill',
      error: 'bi-x-octagon-fill'
    };

    const autohide = type !== 'error';
    const toastEl = document.createElement('div');
    toastEl.className = `toast ${colorMap[type] || colorMap.info}`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    toastEl.innerHTML = `
      <div class="toast-body d-flex align-items-center gap-2">
        <i class="bi ${iconMap[type] || iconMap.info}"></i>
        <span class="flex-grow-1">${message}</span>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="වසන්න"></button>
      </div>
    `;

    container.appendChild(toastEl);

    const toast = new bootstrap.Toast(toastEl, {
      autohide,
      delay: NOTIFICATION_DISMISS_MS
    });

    toastEl.addEventListener('hidden.bs.toast', () => {
      toastEl.remove();
    });

    toast.show();
  },

  /**
   * Render the main dashboard view with XP, level, streak, badges,
   * countdown, and today's plan overview (Req 8.7, 4.1).
   * @param {object} state - Application state containing gamification, syllabus, plan data
   */
  renderDashboard(state) {
    if (!state) return;

    const { gamification, syllabus, plan } = state;

    // Update XP display
    if (gamification) {
      this.updateElement('dashboard-xp', String(gamification.xp || 0));
      this.updateElement('dashboard-level', String(gamification.level || Math.floor((gamification.xp || 0) / 100) + 1));
      this.updateElement('dashboard-streak', String(gamification.streak || 0));
    }

    // Update overall progress
    if (syllabus) {
      const progress = this._calculateOverallProgress(syllabus);
      this.updateElement('dashboard-progress', `${progress}%`);
      // Update floating progress button
      this.updateElement('floating-progress-value', `${progress}%`);
    }

    // Render today's plan overview
    if (plan) {
      const todayPlan = this._getTodayPlan(plan);
      this._renderTodayPlanPreview(todayPlan);
    }

    // Render badges
    if (gamification && gamification.badges) {
      this._renderBadges(gamification.badges);
    }
  },

  /**
   * Render subject cards with progress bars, lesson checkboxes,
   * and exam weight indicators (Req 4.1, 4.2, 4.3, 18.4).
   * @param {object} syllabus - SyllabusState with subjects array
   */
  renderSubjectCards(syllabus, todayPlan) {
    const container = document.getElementById('syllabus-subjects');
    if (!container || !syllabus || !syllabus.subjects) return;

    container.innerHTML = '';

    // Show today's scheduled lessons at the top
    if (todayPlan && todayPlan.lessons && todayPlan.lessons.length > 0) {
      const todayCard = document.createElement('div');
      todayCard.className = 'card border-0 shadow-sm mb-4 border-start border-4 border-primary';
      
      const incompleteTodayLessons = todayPlan.lessons.filter(l => !l.completed);
      const completedTodayLessons = todayPlan.lessons.filter(l => l.completed);

      let todayHtml = `<div class="card-body">`;
      todayHtml += `<h6 class="fw-bold mb-3"><i class="bi bi-calendar-check me-2 text-primary"></i>අද කළ යුතු පාඩම් (${completedTodayLessons.length}/${todayPlan.lessons.length} සම්පූර්ණ)</h6>`;
      
      if (incompleteTodayLessons.length === 0) {
        todayHtml += `<div class="text-center py-3"><i class="bi bi-check-circle-fill text-success fs-2 d-block mb-2"></i><span class="text-success fw-semibold">අද දිනයට සියලුම පාඩම් සම්පූර්ණයි! 🎉</span></div>`;
      } else {
        // Subject name lookup
        const subjectNameMap = {};
        if (syllabus && syllabus.subjects) {
          for (const s of syllabus.subjects) subjectNameMap[s.id] = s.name;
        }

        todayHtml += `<div class="list-group list-group-flush">`;
        for (const lesson of todayPlan.lessons) {
          const isDone = lesson.completed;
          const itemClass = isDone ? 'list-group-item-success' : '';
          const icon = isDone ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-circle text-muted"></i>';
          const subName = subjectNameMap[lesson.subjectId] || lesson.subjectId;
          todayHtml += `<div class="list-group-item ${itemClass} d-flex align-items-center gap-2 border-0 py-2 px-0">`;
          todayHtml += `${icon}`;
          todayHtml += `<span class="badge bg-light text-dark" style="font-size:0.6rem; min-width:55px">${subName}</span>`;
          todayHtml += `<span class="flex-grow-1 ${isDone ? 'text-decoration-line-through text-muted' : ''}">${lesson.name}</span>`;
          todayHtml += `</div>`;
        }
        todayHtml += `</div>`;
      }
      todayHtml += `</div>`;
      todayCard.innerHTML = todayHtml;
      container.appendChild(todayCard);
    }

    // Show all subjects below
    const row = document.createElement('div');
    row.className = 'row g-3';

    for (const subject of syllabus.subjects) {
      const card = this._createSubjectCard(subject);
      row.appendChild(card);
    }

    container.appendChild(row);
  },

  /**
   * Render today's lessons with exam weight labels and completion toggles (Req 18.4).
   * @param {object} plan - DailyPlan object for today
   */
  renderDailyPlan(plan) {
    const container = document.getElementById('planner-daily-plan');
    if (!container) return;

    container.innerHTML = '';

    if (!plan || !plan.lessons || plan.lessons.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-calendar-x fs-1 d-block mb-2"></i>අද සඳහා පාඩම් කිසිවක් සැලසුම් කර නැත.</div>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'list-group';

    for (const lesson of plan.lessons) {
      const item = document.createElement('div');
      item.className = `list-group-item d-flex align-items-center gap-2${lesson.completed ? ' list-group-item-success' : ''}`;
      item.dataset.lessonId = lesson.lessonId;
      item.dataset.subjectId = lesson.subjectId;

      // Completion toggle checkbox
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'form-check-input flex-shrink-0';
      checkbox.checked = !!lesson.completed;
      checkbox.setAttribute('aria-label', `${lesson.name} සම්පූර්ණ කරන්න`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          SyllabusTracker.markCompleted(lesson.subjectId, lesson.lessonId);
        } else {
          SyllabusTracker.markIncomplete(lesson.subjectId, lesson.lessonId);
        }
      });

      // Lesson name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'flex-grow-1';
      nameSpan.textContent = lesson.name;

      // Exam weight badge (Req 18.4)
      const weightBadge = document.createElement('span');
      const weightClass = WEIGHT_BADGE_CLASSES[lesson.examWeight] || WEIGHT_BADGE_CLASSES.low;
      weightBadge.className = `badge ${weightClass}`;
      weightBadge.textContent = WEIGHT_LABELS[lesson.examWeight] || WEIGHT_LABELS.low;

      item.appendChild(checkbox);
      item.appendChild(nameSpan);
      item.appendChild(weightBadge);
      list.appendChild(item);
    }

    container.appendChild(list);

    // Render revision tasks if present
    if (plan.revisionTasks && plan.revisionTasks.length > 0) {
      const revHeader = document.createElement('h6');
      revHeader.className = 'mt-4 mb-2';
      revHeader.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i>පුනරාවලෝකන කාර්යයන්';
      container.appendChild(revHeader);

      const revList = document.createElement('div');
      revList.className = 'list-group';

      for (const task of plan.revisionTasks) {
        const taskItem = document.createElement('div');
        taskItem.className = `list-group-item d-flex align-items-center gap-2${task.completed ? ' list-group-item-success' : ''}`;
        taskItem.innerHTML = `
          <span class="badge bg-info">${task.cycle}</span>
          <span class="flex-grow-1">${task.lesson ? task.lesson.name || task.lessonId : task.lessonId}</span>
        `;
        revList.appendChild(taskItem);
      }

      container.appendChild(revList);
    }
  },

  /**
   * Render progress bars, remaining counts, and Chart.js charts (Req 4.1-4.5, 9.5, 9.6).
   * @param {object} progress - ProgressData with subjects array and overall stats
   */
  renderProgress(progress) {
    if (!progress) return;

    // Render overall progress section
    const overallContainer = document.getElementById('progress-overall');
    if (overallContainer) {
      const overallPercent = progress.overallPercentage || 0;
      const totalCompleted = progress.totalCompleted || 0;
      const totalLessons = progress.totalLessons || 0;
      const remaining = totalLessons - totalCompleted;

      overallContainer.innerHTML = `
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <h6 class="card-title">සමස්ත ප්‍රගතිය</h6>
            <div class="progress mb-2" style="height: 1.5rem;">
              <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" role="progressbar" 
                   style="width: ${overallPercent}%" aria-valuenow="${overallPercent}" aria-valuemin="0" aria-valuemax="100">
                ${overallPercent}%
              </div>
            </div>
            <p class="text-muted small mb-0">${overallPercent}% සම්පූර්ණයි — ${remaining} පාඩම් ඉතිරියි</p>
          </div>
        </div>
      `;
    }

    // Render subject-wise progress (Req 4.1, 4.2, 4.3)
    const subjectsContainer = document.getElementById('progress-subjects');
    if (subjectsContainer && progress.subjects) {
      subjectsContainer.innerHTML = '';

      const row = document.createElement('div');
      row.className = 'row g-3 mt-1';

      for (const subject of progress.subjects) {
        const percentage = subject.percentage || 0;
        const remaining = (subject.total || 0) - (subject.completed || 0);

        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';
        col.innerHTML = `
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="fw-semibold">${subject.name}</span>
                <span class="badge bg-primary">${percentage}%</span>
              </div>
              <div class="progress mb-2" style="height: 0.5rem;">
                <div class="progress-bar" role="progressbar" style="width: ${percentage}%" 
                     aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100"></div>
              </div>
              <small class="text-muted">ඉතිරි: ${remaining}</small>
            </div>
          </div>
        `;
        row.appendChild(col);
      }

      subjectsContainer.appendChild(row);
    }

    // Render Chart.js charts if Chart is available (Req 9.5, 9.6)
    if (typeof Chart !== 'undefined' && progress.subjects) {
      this._renderProgressCharts(progress);
    }
  },

  /**
   * Apply or remove dark mode using Bootstrap's data-bs-theme attribute (Req 17.1, 17.2).
   * @param {boolean} enabled - Whether dark mode should be active
   */
  applyDarkMode(enabled) {
    document.documentElement.setAttribute('data-bs-theme', enabled ? 'dark' : 'light');
  },

  /**
   * Apply a color theme to the application.
   * Sets data-theme on <html> for CSS variable switching.
   * Sets data-bs-theme to 'dark' for the dark theme, 'light' for all others.
   * @param {string} theme - Theme name (ocean, forest, purple, sunset, dark)
   */
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-bs-theme', 'light');
    }
  },

  /**
   * Navigate to a specific view by showing/hiding sections.
   * Updates nav link active states using Bootstrap active class.
   * @param {string} viewName - The view key (e.g., 'dashboard', 'syllabus')
   */
  navigateToView(viewName) {
    // Hide all view sections
    for (const [key, sectionId] of Object.entries(VIEW_SECTIONS)) {
      const section = document.getElementById(sectionId);
      if (section) {
        if (key === viewName) {
          section.removeAttribute('hidden');
          section.classList.add('active');
        } else {
          section.setAttribute('hidden', '');
          section.classList.remove('active');
        }
      }
    }

    // Update all nav active states (sidebar + bottom nav + offcanvas)
    const navLinks = document.querySelectorAll('[data-view]');
    navLinks.forEach(link => {
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  },

  /**
   * Initialize view navigation by attaching click handlers to nav links.
   */
  initNavigation() {
    const navLinks = document.querySelectorAll('[data-view]');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const viewName = link.dataset.view;
        if (viewName) {
          this.navigateToView(viewName);
        }
      });
    });
  },

  /**
   * Update a single element's text content by ID.
   * @param {string} id - Element ID
   * @param {string} content - New text content
   */
  updateElement(id, content) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = content;
    }
  },

  /**
   * Update only the progress badges and bars on subject cards without rebuilding checkboxes.
   * @param {object} syllabus - SyllabusState with subjects array
   */
  updateSubjectProgress(syllabus, todayPlan) {
    // Full re-render of subject cards to update all progress indicators
    this.renderSubjectCards(syllabus, todayPlan);
  },

  // ---- Private helpers ----

  /**
   * Calculate overall progress percentage from syllabus state.
   * @param {object} syllabus - SyllabusState
   * @returns {number} Percentage 0-100
   */
  _calculateOverallProgress(syllabus) {
    if (!syllabus || !syllabus.subjects) return 0;

    let totalLessons = 0;
    let completedLessons = 0;

    for (const subject of syllabus.subjects) {
      if (subject.lessons) {
        totalLessons += subject.lessons.length;
        completedLessons += subject.lessons.filter(l => l.completed).length;
      }
    }

    if (totalLessons === 0) return 0;
    return Math.round((completedLessons / totalLessons) * 100);
  },

  /**
   * Get today's plan from the plan array.
   * @param {Array} planArray - Array of DailyPlan objects
   * @returns {object|null} Today's plan or null
   */
  _getTodayPlan(planArray) {
    if (!Array.isArray(planArray)) return null;
    const today = new Date().toISOString().slice(0, 10);
    return planArray.find(p => p.date === today) || null;
  },

  /**
   * Render today's plan preview in the dashboard.
   * @param {object|null} todayPlan - DailyPlan for today
   */
  _renderTodayPlanPreview(todayPlan) {
    const container = document.getElementById('today-plan-list');
    if (!container) return;

    if (!todayPlan || !todayPlan.lessons || todayPlan.lessons.length === 0) {
      container.innerHTML = '<p class="text-muted mb-0">අද සඳහා පාඩම් කිසිවක් නැත.</p>';
      return;
    }

    const completedCount = todayPlan.lessons.filter(l => l.completed).length;
    const totalCount = todayPlan.lessons.length;

    let html = `<p class="small text-muted mb-2">${completedCount}/${totalCount} සම්පූර්ණයි</p>`;
    html += '<ul class="list-group list-group-flush">';

    for (const lesson of todayPlan.lessons.slice(0, 5)) {
      const icon = lesson.completed
        ? '<i class="bi bi-check-circle-fill text-success me-2"></i>'
        : '<i class="bi bi-circle text-muted me-2"></i>';
      const weightClass = WEIGHT_BADGE_CLASSES[lesson.examWeight] || WEIGHT_BADGE_CLASSES.low;
      html += `<li class="list-group-item d-flex align-items-center px-0 border-0">
        ${icon}
        <span class="flex-grow-1">${lesson.name}</span>
        <span class="badge ${weightClass}">${WEIGHT_LABELS[lesson.examWeight] || WEIGHT_LABELS.low}</span>
      </li>`;
    }

    if (todayPlan.lessons.length > 5) {
      html += `<li class="list-group-item px-0 border-0 text-muted small">තවත් ${todayPlan.lessons.length - 5}ක්...</li>`;
    }

    html += '</ul>';
    container.innerHTML = html;
  },

  /**
   * Render earned badges in the dashboard.
   * @param {Array} badges - Array of Badge objects
   */
  _renderBadges(badges) {
    const container = document.getElementById('dashboard-badges-list');
    if (!container) return;

    const earned = badges.filter(b => b.earnedDate);

    if (earned.length === 0) {
      container.innerHTML = '<p class="text-muted mb-0">තවමත් ජයග්‍රහණ ලැබී නැත.</p>';
      return;
    }

    let html = '<div class="d-flex flex-wrap gap-2">';
    for (const badge of earned) {
      html += `<div class="badge bg-warning text-dark d-flex align-items-center gap-1 py-2 px-3" title="${badge.description || ''}">
        <i class="bi bi-trophy-fill"></i>
        <span>${badge.name}</span>
      </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
  },

  /**
   * Create a subject card element with progress bar and lesson list.
   * Uses Bootstrap card, progress, and form-check components.
   * @param {object} subject - Subject object with lessons
   * @returns {HTMLElement} Column wrapper with card element
   */
  _createSubjectCard(subject) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4';

    const completed = subject.lessons ? subject.lessons.filter(l => l.completed).length : 0;
    const total = subject.lessons ? subject.lessons.length : 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const remaining = total - completed;

    const card = document.createElement('div');
    card.className = 'card border-0 shadow-sm h-100';
    card.dataset.subjectId = subject.id;

    // Card header
    const header = document.createElement('div');
    header.className = 'card-header bg-transparent d-flex justify-content-between align-items-center';
    header.innerHTML = `
      <h6 class="mb-0 fw-semibold">${subject.name}</h6>
      <span class="badge bg-primary">${percentage}%</span>
    `;

    // Card body
    const body = document.createElement('div');
    body.className = 'card-body';

    // Progress bar
    const progressDiv = document.createElement('div');
    progressDiv.className = 'progress mb-2';
    progressDiv.style.height = '0.5rem';
    progressDiv.innerHTML = `<div class="progress-bar" role="progressbar" style="width: ${percentage}%" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100"></div>`;

    // Remaining count
    const remainingEl = document.createElement('p');
    remainingEl.className = 'small text-muted mb-3';
    remainingEl.textContent = `ඉතිරි පාඩම්: ${remaining}`;

    // Lesson list with checkboxes
    const lessonList = document.createElement('div');
    lessonList.className = 'd-flex flex-column gap-1';

    if (subject.lessons) {
      for (const lesson of subject.lessons) {
        const lessonItem = document.createElement('div');
        lessonItem.className = 'form-check';
        lessonItem.dataset.lessonId = lesson.id;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input';
        checkbox.id = `lesson-${subject.id}-${lesson.id}`;
        checkbox.checked = !!lesson.completed;
        checkbox.disabled = !!lesson.completed; // Once completed, can't uncheck
        checkbox.setAttribute('aria-label', `${lesson.name} සම්පූර්ණ කරන්න`);
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            SyllabusTracker.markCompleted(subject.id, lesson.id);
            checkbox.disabled = true; // Lock after completing
          }
          // Immediate visual feedback
          label.classList.toggle('text-decoration-line-through', checkbox.checked);
          label.classList.toggle('text-muted', checkbox.checked);
        });

        const label = document.createElement('label');
        label.className = `form-check-label small${lesson.completed ? ' text-decoration-line-through text-muted' : ''}`;
        label.htmlFor = `lesson-${subject.id}-${lesson.id}`;
        label.textContent = lesson.name;

        // Exam weight badge
        const weightBadge = document.createElement('span');
        const weightClass = WEIGHT_BADGE_CLASSES[lesson.examWeight] || WEIGHT_BADGE_CLASSES.low;
        weightBadge.className = `badge ${weightClass} ms-2`;
        weightBadge.style.fontSize = '0.65rem';
        weightBadge.textContent = WEIGHT_LABELS[lesson.examWeight] || WEIGHT_LABELS.low;

        lessonItem.appendChild(checkbox);
        lessonItem.appendChild(label);
        label.appendChild(weightBadge);
        lessonList.appendChild(lessonItem);
      }
    }

    body.appendChild(progressDiv);
    body.appendChild(remainingEl);
    body.appendChild(lessonList);
    card.appendChild(header);
    card.appendChild(body);
    col.appendChild(card);

    return col;
  },

  /**
   * Render Chart.js charts for progress visualization (Req 9.5, 9.6).
   * @param {object} progress - Progress data with subjects array
   */
  _renderProgressCharts(progress) {
    // Subject-wise bar chart (Req 9.5)
    const barCanvas = document.getElementById('chart-subject-progress');
    if (barCanvas && progress.subjects) {
      const ctx = barCanvas.getContext('2d');

      // Destroy existing chart if any
      if (barCanvas._chartInstance) {
        barCanvas._chartInstance.destroy();
      }

      const labels = progress.subjects.map(s => s.name);
      const data = progress.subjects.map(s => s.percentage || 0);

      barCanvas._chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'ප්‍රගතිය (%)',
            data,
            backgroundColor: 'rgba(13, 110, 253, 0.7)',
            borderColor: '#0d6efd',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: (value) => `${value}%`
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }

    // Overall progress doughnut/ring chart (Req 9.6)
    const ringCanvas = document.getElementById('chart-overall-progress');
    if (ringCanvas && progress.overallPercentage !== undefined) {
      const ctx = ringCanvas.getContext('2d');

      // Destroy existing chart if any
      if (ringCanvas._chartInstance) {
        ringCanvas._chartInstance.destroy();
      }

      const completed = progress.overallPercentage;
      const remaining = 100 - completed;

      ringCanvas._chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['සම්පූර්ණ', 'ඉතිරි'],
          datasets: [{
            data: [completed, remaining],
            backgroundColor: ['#198754', '#dee2e6'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '70%',
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    }
  }
};

export default UIRenderer;
