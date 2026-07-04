/**
 * Application Orchestrator - Main entry point for the O/L 2026 Smart Study Dashboard.
 *
 * Responsibilities:
 * - Execute strict initialization sequence (Req 21.1)
 * - Block interaction until ready (Req 21.2)
 * - Show loading/error UI (Req 21.3, 21.4)
 * - Wire EventBus listeners for inter-module communication (Req 21.5)
 * - Handle view routing/navigation between sections
 *
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5
 */

import StorageEngine from './storage.js';
import SyllabusTracker from './syllabus.js';
import StudyPlanner from './planner.js';
import RevisionManager from './revision.js';
import PastPaperTracker from './pastpapers.js';
import GamificationSystem from './gamification.js';
import AnalyticsSystem from './analytics.js';
import CountdownTimer from './countdown.js';
import SettingsModule from './settings.js';
import UIRenderer from './ui.js';
import EventBus from './event-bus.js';
import { initSettingsUI } from './settings-ui.js';
import AdminPanel from './admin.js';
import Auth from './auth.js';

// ─── State ──────────────────────────────────────────────────────────────────

/** Whether the app has completed initialization */
let initialized = false;

// ─── Countdown Tick Handler ─────────────────────────────────────────────────

/**
 * Update the countdown display on each tick.
 * @param {{ days: number, hours: number, minutes: number, seconds: number }|null} remaining
 */
function onCountdownTick(remaining) {
  const daysEl = document.getElementById('countdown-days');
  const hoursEl = document.getElementById('countdown-hours');
  const minutesEl = document.getElementById('countdown-minutes');
  const secondsEl = document.getElementById('countdown-seconds');

  if (!remaining) {
    if (daysEl) daysEl.textContent = '--';
    if (hoursEl) hoursEl.textContent = '--';
    if (minutesEl) minutesEl.textContent = '--';
    if (secondsEl) secondsEl.textContent = '--';
    return;
  }

  if (daysEl) daysEl.textContent = remaining.days;
  if (hoursEl) hoursEl.textContent = String(remaining.hours).padStart(2, '0');
  if (minutesEl) minutesEl.textContent = String(remaining.minutes).padStart(2, '0');
  if (secondsEl) secondsEl.textContent = String(remaining.seconds).padStart(2, '0');
}

// ─── Dashboard UI Updates ───────────────────────────────────────────────────

/**
 * Build the current app state object for rendering.
 * @returns {object} State for UIRenderer.renderDashboard
 */
function buildDashboardState() {
  const gamState = GamificationSystem.getState();
  return {
    gamification: {
      xp: gamState.xp,
      level: GamificationSystem.getLevel(),
      streak: gamState.streak,
      badges: gamState.badges
    },
    syllabus: SyllabusTracker.getState(),
    plan: StudyPlanner.getPlan()
  };
}

/**
 * Refresh the dashboard display with current state.
 */
function refreshDashboard() {
  UIRenderer.renderDashboard(buildDashboardState());
  renderQuickStats();
}

/**
 * Compute and render the Quick Stats card on the dashboard.
 * Shows: lessons completed today, weakest subject, exam readiness %, total days studied.
 */
function renderQuickStats() {
  const container = document.getElementById('dashboard-quick-stats');
  if (!container) return;

  // 1. Lessons completed today
  const plan = StudyPlanner.getPlan();
  const today = new Date().toISOString().slice(0, 10);
  const todayPlan = Array.isArray(plan) ? plan.find(p => p.date === today) : null;
  const lessonsToday = todayPlan && todayPlan.lessons
    ? todayPlan.lessons.filter(l => l.completed).length
    : 0;
  const totalToday = todayPlan && todayPlan.lessons ? todayPlan.lessons.length : 0;

  // 2. Weakest subject (lowest completion %)
  const syllabusState = SyllabusTracker.getState();
  let weakestName = '—';
  let weakestPct = 0;
  if (syllabusState && syllabusState.subjects && syllabusState.subjects.length > 0) {
    let minPct = 101;
    for (const subject of syllabusState.subjects) {
      const progress = SyllabusTracker.getSubjectProgress(subject.id);
      if (progress.percentage < minPct) {
        minPct = progress.percentage;
        weakestName = subject.name;
        weakestPct = progress.percentage;
      }
    }
  }

  // 3. Exam readiness: syllabus×0.5 + revision×0.3 + papers×0.2
  const overallProgress = SyllabusTracker.getOverallProgress();
  const syllabusPercent = overallProgress.percentage || 0;

  const revState = RevisionManager.getState();
  const totalRevisionTasks = revState.r1Queue.length + revState.r2Queue.length + revState.finalQueue.length;
  const completedRevision = revState.r1Queue.filter(e => e.completed).length +
    revState.r2Queue.filter(e => e.completed).length +
    revState.finalQueue.filter(e => e.completed).length;
  const revisionPercent = totalRevisionTasks > 0 ? Math.round((completedRevision / totalRevisionTasks) * 100) : 0;

  const pastPaperPercent = Math.round(PastPaperTracker.getOverallCompletion());

  const examReadiness = AnalyticsSystem.getExamReadiness(syllabusPercent, revisionPercent, pastPaperPercent);

  // 4. Total days studied
  const daysStudied = GamificationSystem.studyDates ? GamificationSystem.studyDates.length : 0;

  container.innerHTML = `
    <div class="row g-3">
      <div class="col-6">
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-check2-circle text-success fs-5"></i>
          <div>
            <div class="small text-muted">අද සම්පූර්ණ කළ පාඩම්</div>
            <div class="fw-bold">${lessonsToday} / ${totalToday}</div>
          </div>
        </div>
      </div>
      <div class="col-6">
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-exclamation-triangle text-warning fs-5"></i>
          <div>
            <div class="small text-muted">දුර්වලම විෂය</div>
            <div class="fw-bold">${weakestName} <span class="text-muted small">(${weakestPct}%)</span></div>
          </div>
        </div>
      </div>
      <div class="col-6">
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-clipboard-check text-primary fs-5"></i>
          <div>
            <div class="small text-muted">විභාග සූදානම</div>
            <div class="fw-bold">${examReadiness}%</div>
          </div>
        </div>
      </div>
      <div class="col-6">
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-calendar-check text-info fs-5"></i>
          <div>
            <div class="small text-muted">මුළු අධ්‍යයන දින</div>
            <div class="fw-bold">${daysStudied}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Build progress data for UIRenderer.renderProgress.
 * @returns {object} Progress data
 */
function buildProgressData() {
  const syllabusState = SyllabusTracker.getState();
  const overall = SyllabusTracker.getOverallProgress();
  const subjects = syllabusState.subjects.map(subject => {
    const progress = SyllabusTracker.getSubjectProgress(subject.id);
    return {
      id: subject.id,
      name: subject.name,
      completed: progress.completed,
      total: progress.total,
      percentage: progress.percentage
    };
  });

  return {
    overallPercentage: overall.percentage,
    totalCompleted: overall.completed,
    totalLessons: overall.total,
    subjects
  };
}

/**
 * Render the full multi-day plan on the planner page.
 */
function renderFullPlan() {
  const container = document.getElementById('planner-daily-plan');
  if (!container) return;

  const plan = StudyPlanner.getPlan();
  if (!plan || plan.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="bi bi-calendar-plus fs-1 d-block mb-3 text-muted"></i>
        <h5 class="text-muted">අධ්‍යයන සැලසුමක් නැත</h5>
        <p class="text-muted small">සැකසුම් තුළ විභාග දිනය සකසන්න — ස්වයංක්‍රීයව සැලසුම ජනනය වේ.</p>
      </div>`;
    return;
  }

  // Subject color map for visual grouping
  const subjectColors = {
    mathematics: '#1E88E5', science: '#43A047', sinhala: '#7B1FA2',
    english: '#E65100', history: '#795548', buddhism: '#FF8F00',
    ict: '#00ACC1', drama: '#EC407A', entrepreneurship: '#5C6BC0'
  };

  const today = new Date().toISOString().slice(0, 10);
  const totalLessons = plan.reduce((sum, d) => sum + d.lessons.length, 0);
  const totalDays = plan.filter(d => d.lessons.length > 0).length;

  // Summary bar
  let html = `
    <div class="card border-0 shadow-sm mb-4" style="background: var(--ol-gradient); color: white;">
      <div class="card-body py-3">
        <div class="row text-center">
          <div class="col-4">
            <div class="fw-bold fs-5">${totalLessons}</div>
            <div class="small opacity-75">මුළු පාඩම්</div>
          </div>
          <div class="col-4">
            <div class="fw-bold fs-5">${totalDays}</div>
            <div class="small opacity-75">සැලසුම් දින</div>
          </div>
          <div class="col-4">
            <div class="fw-bold fs-5">${Math.ceil(totalLessons / Math.max(totalDays, 1))}</div>
            <div class="small opacity-75">දිනකට සාමාන්‍ය</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Day cards in grid layout
  const daysToShow = plan.filter(d => d.lessons.length > 0).slice(0, 21);

  html += `<div class="row g-3">`;

  for (const day of daysToShow) {
    const isToday = day.date === today;
    const dateObj = new Date(day.date);
    const dayName = dateObj.toLocaleDateString('si-LK', { weekday: 'short' });
    const dateFormatted = dateObj.toLocaleDateString('si-LK', { month: 'short', day: 'numeric' });

    const cardBorder = isToday ? 'border-start border-4 border-primary' : '';
    const todayBadge = isToday ? '<span class="badge bg-primary ms-1" style="font-size:0.6rem">අද</span>' : '';

    html += `<div class="col-sm-6 col-md-4 col-lg-3">`;
    html += `<div class="card border-0 shadow-sm h-100 ${cardBorder}">`;
    html += `<div class="card-body py-2 px-3">`;
    html += `<div class="d-flex align-items-center justify-content-between mb-2">`;
    html += `<span class="fw-semibold small">${dayName} ${dateFormatted}${todayBadge}</span>`;
    html += `<span class="badge rounded-pill bg-light text-dark" style="font-size:0.65rem">${day.lessons.length}</span>`;
    html += `</div>`;

    // Render lessons with time slots (45 min per lesson, 15 min break, start at 6:00)
    html += `<div class="d-flex flex-column gap-1">`;
    let startHour = 6;
    let startMin = 0;

    for (let i = 0; i < day.lessons.length; i++) {
      const lesson = day.lessons[i];
      const color = subjectColors[lesson.subjectId] || '#6c757d';
      const endMin = startMin + 45;
      const endHour = startHour + Math.floor(endMin / 60);
      const endMinFinal = endMin % 60;

      const timeStr = `${String(startHour).padStart(2,'0')}:${String(startMin).padStart(2,'0')}-${String(endHour).padStart(2,'0')}:${String(endMinFinal).padStart(2,'0')}`;
      const weightIcon = lesson.examWeight === 'high' ? '⚡' : lesson.examWeight === 'medium' ? '●' : '○';
      const shortName = lesson.name.length > 18 ? lesson.name.slice(0, 17) + '…' : lesson.name;

      html += `<div class="d-flex align-items-center gap-2 py-1">`;
      html += `<span class="text-muted" style="font-size:0.6rem; min-width:70px; font-family:monospace">${timeStr}</span>`;
      html += `<span class="badge rounded-pill py-1 px-2 flex-grow-1 text-start" style="background:${color}12; color:${color}; border:1px solid ${color}25; font-size:0.65rem; font-weight:500;">${weightIcon} ${shortName}</span>`;
      html += `</div>`;

      // Next slot: add 45min lesson + 15min break = 60min total
      startMin += 60;
      startHour += Math.floor(startMin / 60);
      startMin = startMin % 60;
    }

    // Show paper sessions if scheduled for this day
    if (day.paperSessions && day.paperSessions.length > 0) {
      html += `<div class="mt-2 pt-2 border-top">`;
      html += `<div class="small fw-semibold text-muted mb-1"><i class="bi bi-file-earmark-text me-1"></i>පසුගිය ප්‍රශ්න පත්‍ර</div>`;
      for (const paper of day.paperSessions) {
        const timeStr = `${String(startHour).padStart(2,'0')}:${String(startMin).padStart(2,'0')}-${String(startHour + 1).padStart(2,'0')}:${String(startMin).padStart(2,'0')}`;
        html += `<div class="d-flex align-items-center gap-2 py-1">`;
        html += `<span class="text-muted" style="font-size:0.6rem; min-width:70px; font-family:monospace">${timeStr}</span>`;
        html += `<span class="badge rounded-pill py-1 px-2 flex-grow-1 text-start" style="background:#795548.15; color:#795548; border:1px solid #79554830; font-size:0.65rem;">📝 ${paper.subjectName} ${paper.year}</span>`;
        html += `</div>`;
        startMin += 60;
        startHour += Math.floor(startMin / 60);
        startMin = startMin % 60;
      }
      html += `</div>`;
    }

    html += `</div>`;
    html += `</div></div></div>`;
  }

  html += `</div>`;

  // Show overload warning if applicable
  const warning = StudyPlanner.getOverloadWarning();
  const warningEl = document.getElementById('planner-warning');
  if (warningEl) {
    if (warning) {
      warningEl.querySelector('span').textContent = warning;
      warningEl.removeAttribute('hidden');
    } else {
      warningEl.setAttribute('hidden', '');
    }
  }

  container.innerHTML = html;
}

/**
 * Render the revision page with scheduled revisions and queue status.
 */
function renderRevisionPage() {
  const todayContainer = document.getElementById('revision-today');
  const queuesContainer = document.getElementById('revision-queues');
  if (!todayContainer || !queuesContainer) return;

  const state = RevisionManager.getState();
  const today = new Date();
  const todayRevisions = RevisionManager.getScheduledRevisions(today);

  // Today's revisions
  if (todayRevisions.length === 0) {
    todayContainer.innerHTML = `<div class="card border-0 shadow-sm"><div class="card-body text-center text-muted py-4"><i class="bi bi-check-circle fs-1 d-block mb-2 text-success"></i>අද සඳහා පුනරාවලෝකන කාර්යයන් නොමැත.</div></div>`;
  } else {
    let html = `<div class="card border-0 shadow-sm"><div class="card-header bg-transparent"><h6 class="fw-semibold mb-0"><i class="bi bi-calendar-day me-2"></i>අද පුනරාවලෝකනය (${todayRevisions.length})</h6></div><div class="card-body p-0"><ul class="list-group list-group-flush">`;
    for (const task of todayRevisions) {
      const cycleColor = task.cycle === 'R1' ? 'bg-info' : task.cycle === 'R2' ? 'bg-warning text-dark' : 'bg-success';
      html += `<li class="list-group-item d-flex align-items-center gap-2"><span class="badge ${cycleColor}">${task.cycle}</span><span class="flex-grow-1">${task.lesson.id}</span></li>`;
    }
    html += `</ul></div></div>`;
    todayContainer.innerHTML = html;
  }

  // Queue summary
  const r1Pending = state.r1Queue.filter(e => !e.completed).length;
  const r2Pending = state.r2Queue.filter(e => !e.completed).length;
  const finalPending = state.finalQueue.filter(e => !e.completed).length;

  queuesContainer.innerHTML = `
    <div class="row g-3 mt-2">
      <div class="col-4"><div class="card border-0 shadow-sm text-center p-3"><div class="text-info fw-bold fs-4">${r1Pending}</div><div class="small text-muted">R1 පොරොත්තු</div></div></div>
      <div class="col-4"><div class="card border-0 shadow-sm text-center p-3"><div class="text-warning fw-bold fs-4">${r2Pending}</div><div class="small text-muted">R2 පොරොත්තු</div></div></div>
      <div class="col-4"><div class="card border-0 shadow-sm text-center p-3"><div class="text-success fw-bold fs-4">${finalPending}</div><div class="small text-muted">අවසන් පොරොත්තු</div></div></div>
    </div>
  `;
}

/**
 * Render the past papers page with subject-wise paper tracking.
 */
function renderPastPapersPage() {
  const container = document.getElementById('past-papers-subjects');
  if (!container) return;

  const syllabusState = SyllabusTracker.getState();
  if (!syllabusState || !syllabusState.subjects) return;

  let html = '<div class="row g-3">';

  for (const subject of syllabusState.subjects) {
    const completion = PastPaperTracker.getCompletionBySubject(subject.id);
    const pct = completion.total > 0 ? Math.round((completion.completed / completion.total) * 100) : 0;

    html += `<div class="col-md-6 col-lg-4"><div class="card border-0 shadow-sm h-100"><div class="card-body">`;
    html += `<div class="d-flex justify-content-between align-items-center mb-2"><h6 class="mb-0 fw-semibold">${subject.name}</h6><span class="badge bg-primary">${completion.completed}/${completion.total}</span></div>`;
    html += `<div class="progress mb-3" style="height:0.4rem"><div class="progress-bar" style="width:${pct}%"></div></div>`;

    // Year buttons (2015-2025)
    html += `<div class="d-flex flex-wrap gap-1">`;
    for (let year = 2015; year <= 2025; year++) {
      const attempts = PastPaperTracker.getAttempts(subject.id, year);
      const hasAttempt = attempts.length > 0;
      const highScore = PastPaperTracker.getHighestScore(subject.id, year);
      const btnClass = hasAttempt ? 'btn-success' : 'btn-outline-secondary';
      const tooltip = hasAttempt ? `${year} - ඉහළම: ${highScore !== null ? highScore + '%' : 'ලකුණු නැත'}` : `${year} - සම්පූර්ණ කර නැත`;
      html += `<button class="btn btn-sm ${btnClass} past-paper-btn" data-subject="${subject.id}" data-year="${year}" title="${tooltip}" style="font-size:0.7rem;padding:2px 6px">${year}</button>`;
    }
    html += `</div>`;
    html += `</div></div></div>`;
  }

  html += '</div>';
  container.innerHTML = html;

  // Add click handlers for paper buttons
  container.querySelectorAll('.past-paper-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const subjectId = btn.dataset.subject;
      const year = parseInt(btn.dataset.year);
      const score = prompt('ලකුණු ඇතුලත් කරන්න (0-100, හිස් නම් ලකුණු නැතිව):');
      const scoreNum = score !== null && score !== '' ? parseInt(score) : undefined;
      PastPaperTracker.recordAttempt(subjectId, year, scoreNum);
      btn.classList.remove('btn-outline-secondary');
      btn.classList.add('btn-success');
      renderPastPapersPage(); // Re-render to update counts
    });
  });
}

// ─── EventBus Wiring ────────────────────────────────────────────────────────

/**
 * Wire up EventBus listeners for inter-module communication.
 * These coordinate state updates and UI refreshes across the system.
 *
 * Note: Individual modules register their own internal listeners:
 * - GamificationSystem.initListeners() → handles XP & streak on lesson:completed, revision:completed
 * - RevisionManager.initialize() → auto-adds to R1 queue on lesson:completed
 * - StudyPlanner.initListeners() → recalculates plan on lesson:completed, settings:changed
 *
 * This function wires the orchestrator-level UI updates and cross-cutting concerns.
 */
function wireEventListeners() {
  // lesson:completed → update progress UI, check achievements
  EventBus.on('lesson:completed', () => {
    console.log('[App] lesson:completed event received, initialized:', initialized);
    if (!initialized) return;
    refreshDashboard();
    UIRenderer.renderProgress(buildProgressData());
    UIRenderer.updateSubjectProgress(SyllabusTracker.getState(), StudyPlanner.getTodaysPlan());
    GamificationSystem.checkAchievements({
      syllabus: SyllabusTracker.getState(),
      gamification: GamificationSystem.getState(),
      pastpapers: PastPaperTracker.state
    });
  });

  // lesson:uncompleted → update progress UI
  EventBus.on('lesson:uncompleted', () => {
    if (!initialized) return;
    refreshDashboard();
    UIRenderer.renderProgress(buildProgressData());
    UIRenderer.updateSubjectProgress(SyllabusTracker.getState(), StudyPlanner.getTodaysPlan());
  });

  // revision:completed → update dashboard stats (XP awarded by GamificationSystem internally)
  EventBus.on('revision:completed', () => {
    if (!initialized) return;
    refreshDashboard();
  });

  // settings:changed → restart countdown, apply theme, update dashboard
  EventBus.on('settings:changed', (data) => {
    if (!initialized) return;

    if (data && data.key === 'examDate') {
      CountdownTimer.start(data.value, onCountdownTick);
    }

    if (data && data.key === 'darkMode') {
      UIRenderer.applyDarkMode(data.value);
    }

    if (data && data.key === 'theme') {
      UIRenderer.applyTheme(data.value);
    }

    // Plan recalculation is handled by StudyPlanner.initListeners()
    // Refresh dashboard after a short delay to allow plan to recalculate
    setTimeout(() => {
      refreshDashboard();
    }, 50);
  });

  // plan:recalculated → refresh today's plan on dashboard + planner page
  EventBus.on('plan:recalculated', () => {
    if (!initialized) return;
    refreshDashboard();
    UIRenderer.renderDailyPlan(StudyPlanner.getTodaysPlan());
    renderFullPlan();
    renderRevisionPage();
  });

  // xp:awarded → refresh dashboard stats
  EventBus.on('xp:awarded', () => {
    if (!initialized) return;
    refreshDashboard();
  });

  // streak:updated → refresh dashboard stats
  EventBus.on('streak:updated', () => {
    if (!initialized) return;
    refreshDashboard();
  });

  // badge:earned → refresh dashboard badges
  EventBus.on('badge:earned', () => {
    if (!initialized) return;
    refreshDashboard();
  });

  // storage:error → display warning notification and recommend data export (Req 10.7, 14.7)
  EventBus.on('storage:error', (data) => {
    const message = data && data.error
      ? data.error
      : 'ගබඩා දෝෂයක් සිදු විය. කරුණාකර ඔබේ දත්ත නිර්යාත කර උපස්ථයක් තබා ගන්න.';
    UIRenderer.showNotification(message, 'warning');
  });
}

// ─── Initialization Sequence ────────────────────────────────────────────────

/**
 * Main initialization function.
 * Executes the strict sequence defined in Req 21.1:
 * 1. Show loading indicator (Req 21.3)
 * 2. Load data from StorageEngine
 * 3. Initialize SyllabusTracker
 * 4. Initialize all other modules
 * 5. Generate/load daily plan
 * 6. Render dashboard interface
 * 7. Start CountdownTimer
 * 8. Hide loading indicator (Req 21.5)
 *
 * Blocks interactive elements until syllabus and plan are ready (Req 21.2).
 * Halts on error with retry button that restarts from beginning (Req 21.4).
 */
async function initialize() {
  initialized = false;

  try {
    // Step 1: Show loading indicator, block interaction (Req 21.2, 21.3)
    UIRenderer.showLoading();

    // Step 2: Check storage availability
    if (!StorageEngine.isAvailable()) {
      throw new Error('LocalStorage ලබාගත නොහැක. කරුණාකර බ්‍රවුසරයේ LocalStorage සක්‍රිය කරන්න.');
    }

    // Step 3: Load all persisted data from server (JSON file)
    const savedState = await StorageEngine.loadAllAsync();

    // Step 4: Initialize SettingsModule (needed for plan generation and dark mode)
    SettingsModule.initialize(savedState ? savedState.settings : null);
    const settings = SettingsModule.getSettings();

    // Step 5: Apply theme immediately based on saved preference
    UIRenderer.applyTheme(settings.theme || 'ocean');

    // Step 6: Initialize SyllabusTracker (Req 21.1 - critical step)
    SyllabusTracker.initialize(savedState ? savedState.syllabus : null);

    // Step 7: Initialize GamificationSystem and its event listeners
    GamificationSystem.initialize(savedState ? savedState.gamification : null);
    GamificationSystem.initListeners();

    // Step 8: Initialize RevisionManager (sets up its own lesson:completed listener)
    RevisionManager.initialize(savedState ? savedState.revision : null);

    // Step 9: Initialize PastPaperTracker
    PastPaperTracker.initialize(savedState ? savedState.pastpapers : null);

    // Step 10: Generate or load daily plan (Req 21.1 - critical step)
    StudyPlanner.setSettings(settings);
    if (savedState && savedState.plan && Array.isArray(savedState.plan) && savedState.plan.length > 0) {
      StudyPlanner.setPlan(savedState.plan);
    } else {
      StudyPlanner.generatePlan(SyllabusTracker.getState(), settings);
    }
    StudyPlanner.initListeners();

    // Step 11: Wire orchestrator-level EventBus listeners
    wireEventListeners();

    // Step 12: Render dashboard interface (Req 21.1)
    refreshDashboard();
    UIRenderer.renderSubjectCards(SyllabusTracker.getState(), StudyPlanner.getTodaysPlan());
    UIRenderer.renderProgress(buildProgressData());
    UIRenderer.renderDailyPlan(StudyPlanner.getTodaysPlan());
    renderFullPlan();
    renderRevisionPage();
    renderPastPapersPage();

    // Step 13: Start CountdownTimer (Req 21.1)
    if (settings.examDate) {
      CountdownTimer.start(settings.examDate, onCountdownTick);
    }

    // Step 14: Hide loading, show interactive app (Req 21.2, 21.5)
    UIRenderer.hideLoading();
    initialized = true;

    // Step 15: Set up view navigation
    UIRenderer.initNavigation();

    // Step 16: Wire settings form inputs and export/import buttons
    wireSettingsForm();
    initSettingsUI();

    // Step 17: Initialize admin panel
    AdminPanel.initialize();

    // Handle initial hash-based routing
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`view-${hash}`)) {
      UIRenderer.navigateToView(hash);
    }

    // Enable saves AFTER full initialization — prevents init-time writes from corrupting data
    StorageEngine.enableSaves();

  } catch (error) {
    // Req 21.4: Halt on error, display error with retry that restarts from beginning
    console.error('[App] Initialization error:', error);
    const msg = (error && error.message) ? error.message : 'Unknown error';
    alert('INIT ERROR: ' + msg);
    UIRenderer.showError(msg, initialize);
  }
}

// ─── Service Worker Registration ────────────────────────────────────────────

/**
 * Minimum supported browser versions for required features.
 * Used to inform users when their browser is incompatible.
 */
const SUPPORTED_BROWSERS = 'Chrome 90+, Edge 90+, Firefox 88+';

/**
 * Register the Service Worker with feature detection.
 * Non-blocking: registration failure does not prevent the app from working.
 *
 * - If the browser does not support Service Worker or LocalStorage,
 *   displays a notification with minimum supported browser versions (Req 13.5).
 * - Logs registration errors; app continues without offline support (Req 10.1, 13.4).
 */
function registerServiceWorker() {
  // Check for LocalStorage support
  const localStorageSupported = StorageEngine.isAvailable();

  // Check for Service Worker support
  const serviceWorkerSupported = 'serviceWorker' in navigator;

  if (!localStorageSupported || !serviceWorkerSupported) {
    const missingFeatures = [];
    if (!serviceWorkerSupported) missingFeatures.push('Service Worker');
    if (!localStorageSupported) missingFeatures.push('LocalStorage');

    // Req 13.5: Display notification about unsupported browser
    UIRenderer.showNotification(
      `ඔබගේ බ්‍රවුසරය ${missingFeatures.join(' සහ ')} සඳහා සහාය නොදක්වයි. ` +
      `අවම සහය දක්වන බ්‍රවුසර: ${SUPPORTED_BROWSERS}`,
      'warning'
    );
    console.warn(
      `[SW] Browser missing required features: ${missingFeatures.join(', ')}. ` +
      `Minimum supported: ${SUPPORTED_BROWSERS}`
    );
    return;
  }

  // Register Service Worker (non-blocking)
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.log('[SW] Service Worker registered successfully:', registration.scope);
    })
    .catch((error) => {
      // Req 10.1, 13.4: Log error, app continues without offline support
      console.error('[SW] Service Worker registration failed:', error);
    });
}

// ─── Settings Form Wiring ────────────────────────────────────────────────────

/**
 * Wire up the settings form inputs to SettingsModule methods.
 * Connects exam date input, max daily lessons input, and theme selector.
 */
function wireSettingsForm() {
  const examDateInput = document.getElementById('settings-exam-date');
  const maxLessonsInput = document.getElementById('settings-max-lessons');
  const themeSelect = document.getElementById('settings-theme');
  const examDateError = document.getElementById('settings-exam-date-error');
  const maxLessonsError = document.getElementById('settings-max-lessons-error');

  // Pre-fill current settings values
  const settings = SettingsModule.getSettings();
  if (examDateInput && settings.examDate) {
    examDateInput.value = settings.examDate;
  }
  if (maxLessonsInput) {
    maxLessonsInput.value = settings.maxDailyLessons;
  }
  if (themeSelect) {
    themeSelect.value = settings.theme || 'ocean';
  }

  // Wire exam date change
  if (examDateInput) {
    examDateInput.addEventListener('change', () => {
      const result = SettingsModule.setExamDate(examDateInput.value);
      if (examDateError) {
        if (!result.success) {
          examDateError.textContent = result.error;
          examDateError.hidden = false;
        } else {
          examDateError.hidden = true;
        }
      }
    });
  }

  // Wire max daily lessons change
  if (maxLessonsInput) {
    maxLessonsInput.addEventListener('change', () => {
      const value = parseInt(maxLessonsInput.value, 10);
      const result = SettingsModule.setMaxDailyLessons(value);
      if (maxLessonsError) {
        if (!result.success) {
          maxLessonsError.textContent = result.error;
          maxLessonsError.hidden = false;
        } else {
          maxLessonsError.hidden = true;
        }
      }
    });
  }

  // Wire theme selector
  if (themeSelect) {
    themeSelect.addEventListener('change', () => {
      SettingsModule.setTheme(themeSelect.value);
    });
  }
}

// ─── Entry Point ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Require login before initializing the app
  if (!Auth.isLoggedIn()) {
    await Auth.showLoginModal();
  }

  // Show username in navbar
  const brand = document.querySelector('.navbar-brand');
  if (brand) {
    brand.innerHTML = `<i class="bi bi-book me-1"></i>O/L 2026 — ${Auth.getUsername()}`;
  }

  // Add logout button to settings
  const logoutArea = document.getElementById('settings-data');
  if (logoutArea) {
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn btn-outline-danger ms-2';
    logoutBtn.innerHTML = '<i class="bi bi-box-arrow-right me-1"></i>ඉවත් වන්න';
    logoutBtn.addEventListener('click', () => {
      Auth.clearSession();
      location.reload();
    });
    logoutArea.appendChild(logoutBtn);
  }

  initialize();
  registerServiceWorker();
});
