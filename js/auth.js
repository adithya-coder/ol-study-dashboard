/**
 * Auth module — simple username/password login/register
 * Stores userId in sessionStorage after successful login
 */

const Auth = {
  isLoggedIn() {
    return !!sessionStorage.getItem('ol_user_id');
  },

  getUserId() {
    return sessionStorage.getItem('ol_user_id');
  },

  getUsername() {
    return sessionStorage.getItem('ol_username') || 'Student';
  },

  setSession(userId, username) {
    sessionStorage.setItem('ol_user_id', userId);
    sessionStorage.setItem('ol_username', username);
  },

  clearSession() {
    sessionStorage.removeItem('ol_user_id');
    sessionStorage.removeItem('ol_username');
  },

  async register(username, password) {
    const res = await fetch('/api/auth?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return res.json();
  },

  async login(username, password) {
    const res = await fetch('/api/auth?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return res.json();
  },

  /**
   * Show login/register modal. Returns a Promise that resolves when logged in.
   */
  showLoginModal() {
    return new Promise((resolve) => {
      // Remove existing modal if any
      const existing = document.getElementById('auth-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'auth-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:1rem';

      modal.innerHTML = `
        <div class="card border-0 shadow-lg" style="max-width:400px;width:100%">
          <div class="card-body p-4">
            <div class="text-center mb-4">
              <i class="bi bi-book fs-1 text-primary d-block mb-2"></i>
              <h4 class="fw-bold">O/L 2026 අධ්‍යයන පුවරුව</h4>
              <p class="text-muted small">ඔබගේ ගිණුමට ඇතුල් වන්න</p>
            </div>
            <div id="auth-error" class="alert alert-danger d-none"></div>
            <ul class="nav nav-pills mb-3 justify-content-center" id="auth-tabs">
              <li class="nav-item"><button class="nav-link active px-4" data-tab="login">ඇතුල් වන්න</button></li>
              <li class="nav-item"><button class="nav-link px-4" data-tab="register">ලියාපදිංචි</button></li>
            </ul>
            <div id="auth-form">
              <div class="mb-3">
                <label class="form-label">පරිශීලක නාමය</label>
                <input type="text" id="auth-username" class="form-control" placeholder="username" autocomplete="username">
              </div>
              <div class="mb-3">
                <label class="form-label">මුරපදය</label>
                <input type="password" id="auth-password" class="form-control" placeholder="password" autocomplete="current-password">
              </div>
              <button id="auth-submit-btn" class="btn btn-primary w-100 mb-2">ඇතුල් වන්න</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      let currentTab = 'login';

      // Tab switching
      modal.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          currentTab = btn.dataset.tab;
          modal.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab));
          const submitBtn = document.getElementById('auth-submit-btn');
          submitBtn.textContent = currentTab === 'login' ? 'ඇතුල් වන්න' : 'ලියාපදිංචි වන්න';
          document.getElementById('auth-error').classList.add('d-none');
        });
      });

      // Submit
      const handleSubmit = async () => {
        const username = document.getElementById('auth-username').value.trim();
        const password = document.getElementById('auth-password').value;
        const errorEl = document.getElementById('auth-error');
        const submitBtn = document.getElementById('auth-submit-btn');

        if (!username || !password) {
          errorEl.textContent = 'කරුණාකර username සහ password ඇතුලත් කරන්න';
          errorEl.classList.remove('d-none');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>කරමින්...';

        const result = currentTab === 'login'
          ? await Auth.login(username, password)
          : await Auth.register(username, password);

        submitBtn.disabled = false;
        submitBtn.textContent = currentTab === 'login' ? 'ඇතුල් වන්න' : 'ලියාපදිංචි වන්න';

        if (result.success) {
          Auth.setSession(result.userId, result.username);
          modal.remove();
          resolve(result);
        } else {
          errorEl.textContent = result.error || 'දෝෂයක් සිදු විය';
          errorEl.classList.remove('d-none');
        }
      };

      document.getElementById('auth-submit-btn').addEventListener('click', handleSubmit);
      document.getElementById('auth-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSubmit();
      });

      // Focus username
      setTimeout(() => document.getElementById('auth-username')?.focus(), 100);
    });
  }
};

export default Auth;
