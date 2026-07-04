/**
 * Local development server for O/L Study Dashboard.
 * Matches the Vercel API endpoint pattern: /api/state?key=X
 */
import crypto from 'crypto';
import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;
const DATA_DIR = join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'app-state.json');
const USERS_FILE = join(DATA_DIR, 'users.json');
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}
if (!existsSync(USERS_FILE)) {
  mkdirSync(USERS_FILE, { recursive: true });
}

app.use(express.json({ limit: '5mb' }));

// Single API endpoint: /api/state
app.get('/api/state', (req, res) => {
  try {
    if (!existsSync(DATA_FILE)) return res.json(null);
    const data = readFileSync(DATA_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.json(null);
  }
});

app.post('/api/state', (req, res) => {
  try {
    const { key } = req.query;

    if (key) {
      // Save single module
      let state = {};
      if (existsSync(DATA_FILE)) {
        const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          state = raw;
        }
      }
      state[key] = req.body;
      writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
      console.log(`[API] Saved: ${key}`);
    } else {
      // Save full state
      writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), 'utf8');
      console.log('[API] Saved full state');
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


function loadUsers() {
  if (!existsSync(USERS_FILE)) return {};
  return JSON.parse(readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(username, password) {
  return crypto
    .createHash('sha256')
    .update(`${username}:${password}`)
    .digest('hex');
}

app.post('/api/auth', (req, res) => {
  const { action } = req.query;
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required'
    });
  }

  const user = username.trim().toLowerCase();
  const users = loadUsers();

  if (action === 'register') {
    if (users[user]) {
      return res.status(409).json({
        success: false,
        error: 'Username already exists'
      });
    }

    users[user] = {
      password: hashPassword(user, password),
      created: new Date().toISOString()
    };

    saveUsers(users);

    console.log(`[REGISTER] ${user}`);

    return res.json({
      success: true,
      username: user
    });
  }

  if (action === 'login') {
    const account = users[user];

    if (!account) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    const hash = hashPassword(user, password);

    if (account.password !== hash) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    console.log(`[LOGIN] ${user}`);

    return res.json({
      success: true,
      username: user
    });
  }

  res.status(400).json({
    success: false,
    error: 'Invalid action'
  });
});

// Static files AFTER API
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`\n  O/L Study Dashboard — http://localhost:${PORT}\n`);
});
