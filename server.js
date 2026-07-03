/**
 * Simple Express server for O/L Study Dashboard.
 * Serves static files AND provides a JSON file-based API for data persistence.
 * Data is stored in data/app-state.json (survives browser cache clears).
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

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json({ limit: '5mb' }));

// API routes BEFORE static files

// GET /api/state — Load all app state
app.get('/api/state', (req, res) => {
  try {
    if (!existsSync(DATA_FILE)) {
      return res.json(null);
    }
    const data = readFileSync(DATA_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('[API] Error reading state:', err.message);
    res.json(null);
  }
});

// POST /api/state — Save full app state
app.post('/api/state', (req, res) => {
  try {
    writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ success: true });
  } catch (err) {
    console.error('[API] Error saving state:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/module/:key — Save a single module
app.post('/api/module/:key', (req, res) => {
  try {
    let state = {};
    if (existsSync(DATA_FILE)) {
      state = JSON.parse(readFileSync(DATA_FILE, 'utf8')) || {};
    }
    state[req.params.key] = req.body;
    writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
    console.log(`[API] Saved module: ${req.params.key}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] Error saving module:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve static files AFTER API routes
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`\n  O/L Study Dashboard Server`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Data file: ${DATA_FILE}\n`);
});
