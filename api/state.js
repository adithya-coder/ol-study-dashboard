// Vercel Serverless Function: /api/state
// Uses Vercel Blob (private) for persistent JSON storage

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    // No blob configured — return null for GET, success for POST (no-op)
    if (req.method === 'GET') return res.status(200).json(null);
    if (req.method === 'POST') return res.status(200).json({ success: true, note: 'no storage configured' });
    return res.status(405).end();
  }

  let blob;
  try {
    blob = await import('@vercel/blob');
  } catch (e) {
    if (req.method === 'GET') return res.status(200).json(null);
    return res.status(500).json({ success: false, error: 'blob module not found' });
  }

  const BLOB_NAME = 'app-state.json';

  // Helper: read current state from blob
  async function readState() {
    try {
      const { blobs } = await blob.list({ prefix: BLOB_NAME, token });
      if (blobs.length > 0) {
        const response = await fetch(blobs[0].downloadUrl);
        if (response.ok) {
          const data = await response.json();
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            return data;
          }
        }
      }
    } catch (e) {
      console.error('[readState]', e.message);
    }
    return {};
  }

  // Helper: write state to blob (overwrite, no delete needed)
  async function writeState(state) {
    await blob.put(BLOB_NAME, JSON.stringify(state), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      token
    });
  }

  if (req.method === 'GET') {
    try {
      const state = await readState();
      return res.status(200).json(Object.keys(state).length > 0 ? state : null);
    } catch (err) {
      console.error('[GET]', err.message);
      return res.status(200).json(null);
    }
  }

  if (req.method === 'POST') {
    try {
      const { key } = req.query;
      
      // Retry logic for race conditions
      let attempts = 0;
      while (attempts < 3) {
        try {
          let state = await readState();

          if (key) {
            state[key] = req.body;
          } else {
            state = req.body;
          }

          await writeState(state);
          return res.status(200).json({ success: true });
        } catch (err) {
          if (err.message && err.message.includes('conflicting operation') && attempts < 2) {
            attempts++;
            await new Promise(r => setTimeout(r, 100 * attempts)); // Wait 100ms, 200ms
            continue;
          }
          throw err;
        }
      }
    } catch (err) {
      console.error('[POST]', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
