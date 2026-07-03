// Vercel Serverless Function: POST /api/module/:key
// Saves a single module's state

let memoryState = null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key } = req.query;

  let kv = null;
  try {
    const { kv: kvStore } = await import('@vercel/kv');
    kv = kvStore;
  } catch (e) {}

  try {
    // Load current state
    let state = {};
    if (kv) {
      state = (await kv.get('app_state')) || {};
    } else {
      state = memoryState || {};
    }

    // Update the module
    state[key] = req.body;

    // Save
    if (kv) {
      await kv.set('app_state', state);
    }
    memoryState = state;

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
