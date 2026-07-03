/**
 * AnalyticsSystem - Study statistics, weakness analysis, and exam readiness.
 *
 * Provides:
 * - Total study statistics (lessons completed, XP, days studied)
 * - Weak subject identification (below-average completion)
 * - Exam readiness calculation (weighted formula)
 * - Chart rendering via Chart.js (bar chart for subjects, doughnut for overall/readiness)
 *
 * Dependencies:
 * - SyllabusTracker: for lesson completion data
 * - GamificationSystem: for XP and study dates
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

import SyllabusTracker from './syllabus.js';
import GamificationSystem from './gamification.js';

const AnalyticsSystem = {
  /**
   * Get total study statistics.
   *
   * - lessonsCompleted: count of completed lessons across all subjects
   * - totalXP: total experience points earned
   * - daysStudied: number of distinct calendar days with at least one lesson completed
   *
   * @returns {{ lessonsCompleted: number, totalXP: number, daysStudied: number }}
   */
  getTotalStats() {
    const overall = SyllabusTracker.getOverallProgress();
    const totalXP = GamificationSystem.getTotalXP();
    const studyDates = GamificationSystem.studyDates || [];

    return {
      lessonsCompleted: overall.completed,
      totalXP: totalXP,
      daysStudied: studyDates.length
    };
  },

  /**
   * Identify weak subjects — those with completion percentage strictly
   * below the arithmetic mean of all subject percentages.
   *
   * When all subjects have equal completion percentages, returns an empty array.
   *
   * @param {Map<string, number>|Object<string, number>} progress -
   *   A map/object of subjectId → completion percentage (0-100)
   * @returns {string[]} Array of subjectId strings for weak subjects
   */
  getWeakSubjects(progress) {
    // Normalize input: accept Map or plain object
    let entries;
    if (progress instanceof Map) {
      entries = Array.from(progress.entries());
    } else if (progress && typeof progress === 'object') {
      entries = Object.entries(progress).map(([k, v]) => [k, v]);
    } else {
      return [];
    }

    if (entries.length === 0) {
      return [];
    }

    // Calculate arithmetic mean of all completion percentages
    const sum = entries.reduce((acc, [, pct]) => acc + pct, 0);
    const mean = sum / entries.length;

    // Return subjects strictly below mean
    const weak = entries
      .filter(([, pct]) => pct < mean)
      .map(([subjectId]) => subjectId);

    return weak;
  },

  /**
   * Calculate exam readiness percentage using weighted formula:
   *   readiness = round(syllabusPercent × 0.5 + revisionPercent × 0.3 + pastPaperPercent × 0.2)
   *
   * Each input should be in range [0, 100].
   *
   * @param {number} syllabusPercent - Syllabus completion percentage
   * @param {number} revisionPercent - Revision progress percentage
   * @param {number} pastPaperPercent - Past paper completion percentage
   * @returns {number} Exam readiness score (0-100, rounded)
   */
  getExamReadiness(syllabusPercent, revisionPercent, pastPaperPercent) {
    const readiness = syllabusPercent * 0.5 + revisionPercent * 0.3 + pastPaperPercent * 0.2;
    return Math.round(readiness);
  },

  /**
   * Render charts using Chart.js into a canvas container element.
   *
   * Renders:
   * - A bar chart showing subject-wise completion percentages
   * - A doughnut/ring chart showing overall progress and exam readiness
   *
   * Handles empty state: if no data is available, displays a message
   * indicating no data instead of rendering empty charts.
   *
   * @param {string} canvasId - The DOM element ID of the container for charts
   * @param {object} data - Chart data
   * @param {Array<{subjectId: string, name: string, percentage: number}>} [data.subjects] -
   *   Subject progress data for bar chart
   * @param {number} [data.overallProgress] - Overall completion percentage for doughnut chart
   * @param {number} [data.examReadiness] - Exam readiness percentage for doughnut chart
   */
  renderCharts(canvasId, data) {
    const container = document.getElementById(canvasId);
    if (!container) {
      return;
    }

    // Handle empty state
    if (!data || !data.subjects || data.subjects.length === 0) {
      container.innerHTML = '<p class="chart-empty-message">දත්ත නොමැත — පාඩම් සම්පූර්ණ කිරීමෙන් පසු මෙහි ප්‍රස්තාර පෙන්වනු ඇත.</p>';
      return;
    }

    // Check if all progress is zero (empty state with subjects defined but no completions)
    const hasAnyProgress = data.subjects.some(s => s.percentage > 0) ||
      (data.overallProgress && data.overallProgress > 0) ||
      (data.examReadiness && data.examReadiness > 0);

    if (!hasAnyProgress) {
      container.innerHTML = '<p class="chart-empty-message">දත්ත නොමැත — පාඩම් සම්පූර්ණ කිරීමෙන් පසු මෙහි ප්‍රස්තාර පෙන්වනු ඇත.</p>';
      return;
    }

    // Clear container
    container.innerHTML = '';

    // Create canvas elements for charts
    const barCanvasEl = document.createElement('canvas');
    barCanvasEl.id = `${canvasId}-bar`;
    barCanvasEl.setAttribute('role', 'img');
    barCanvasEl.setAttribute('aria-label', 'විෂය අනුව ප්‍රගතිය - තීරු ප්‍රස්තාරය');
    container.appendChild(barCanvasEl);

    const doughnutCanvasEl = document.createElement('canvas');
    doughnutCanvasEl.id = `${canvasId}-doughnut`;
    doughnutCanvasEl.setAttribute('role', 'img');
    doughnutCanvasEl.setAttribute('aria-label', 'සමස්ත ප්‍රගතිය සහ විභාග සූදානම - වළලු ප්‍රස්තාරය');
    container.appendChild(doughnutCanvasEl);

    // Render bar chart — subject-wise progress
    this._renderBarChart(barCanvasEl, data.subjects);

    // Render doughnut/ring chart — overall progress and readiness
    this._renderDoughnutChart(doughnutCanvasEl, data.overallProgress || 0, data.examReadiness || 0);
  },

  /**
   * Render a bar chart for subject-wise completion.
   * @private
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{name: string, percentage: number}>} subjects
   */
  _renderBarChart(canvas, subjects) {
    // Guard: Chart.js must be loaded as global
    if (typeof Chart === 'undefined') {
      return;
    }

    const labels = subjects.map(s => s.name);
    const percentages = subjects.map(s => s.percentage);

    // Color bars based on progress level
    const backgroundColors = percentages.map(pct => {
      if (pct >= 75) return '#43A047'; // Success Green
      if (pct >= 40) return '#1E88E5'; // Primary Blue
      return '#FB8C00'; // Warning Orange
    });

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'සම්පූර්ණ කළ %',
          data: percentages,
          backgroundColor: backgroundColors,
          borderWidth: 0,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (value) => `${value}%`
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 0
            }
          }
        }
      }
    });
  },

  /**
   * Render a doughnut/ring chart for overall progress and exam readiness.
   * @private
   * @param {HTMLCanvasElement} canvas
   * @param {number} overallProgress - Overall completion percentage
   * @param {number} examReadiness - Exam readiness percentage
   */
  _renderDoughnutChart(canvas, overallProgress, examReadiness) {
    // Guard: Chart.js must be loaded as global
    if (typeof Chart === 'undefined') {
      return;
    }

    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['සමස්ත ප්‍රගතිය', 'විභාග සූදානම', 'ඉතිරි'],
        datasets: [{
          data: [overallProgress, examReadiness, Math.max(0, 100 - Math.max(overallProgress, examReadiness))],
          backgroundColor: ['#43A047', '#1E88E5', '#E0E0E0'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${context.parsed}%`
            }
          }
        }
      }
    });
  }
};

export default AnalyticsSystem;
