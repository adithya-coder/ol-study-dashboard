// Vercel Serverless Function: /api/state
// GET  /api/state        → returns full state
// POST /api/state        → saves full state
// POST /api/state?key=X  → saves single module

let memoryState = null;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Try Vercel KV
  let kv = null;
  try {
    const mod = await import('@vercel/kv');
    kv = mod.kv;
  } catch (e) {}

  if (req.method === 'GET') {
    try {
      if (kv) {
        const state = await kv.get('app_state');
        return res.status(200).json(state || null);
      }
      return res.status(200).json(memoryState);
    } catch (err) {
      return res.status(200).json(memoryState);
    }
  }

  if (req.method === 'POST') {
    try {
      const { key } = req.query;
      const body = req.body;

      if (key) {
        // Save single module: POST /api/state?key=syllabus
        let state = {};
        if (kv) {
          state = (await kv.get('app_state')) || {};
        } else {
          state = memoryState || {};
        }
        state[key] = body;
        if (kv) await kv.set('app_state', state);
        memoryState = state;
      } else {
        // Save full state: POST /api/state
        if (kv) await kv.set('app_state', body);
        memoryState = body;
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
