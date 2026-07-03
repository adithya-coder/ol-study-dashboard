/**
 * Local development server for O/L Study Dashboard.
 * Matches the Vercel API endpoint pattern: /api/state?key=X
 */

import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;
const DATA_DIR = join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'app-state.json');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
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
        state = JSON.parse(readFileSync(DATA_FILE, 'utf8')) || {};
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

// Static files AFTER API
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`\n  O/L Study Dashboard — http://localhost:${PORT}\n`);
});
