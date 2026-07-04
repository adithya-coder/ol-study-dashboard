// Vercel Serverless Function: /api/state
// Per-user data stored in Vercel Blob as {userId}/app-state.json

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const userId = req.headers['x-user-id'] || 'default';

  // Sanitize userId (only alphanumeric + dash + underscore)
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'default';

  if (!token) {
    if (req.method === 'GET') return res.status(200).json(null);
    if (req.method === 'POST') return res.status(200).json({ success: true });
    return res.status(405).end();
  }

  let blob;
  try {
    blob = await import('@vercel/blob');
  } catch (e) {
    return res.status(500).json({ success: false, error: 'blob module unavailable' });
  }

  const BLOB_NAME = `users/${safeUserId}/app-state.json`;

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
    } catch (e) { console.error('[readState]', e.message); }
    return {};
  }

  async function writeState(state) {
    await blob.put(BLOB_NAME, JSON.stringify(state), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      token
    });
  }

  if (req.method === 'GET') {
    try {
      const state = await readState();
      return res.status(200).json(Object.keys(state).length > 0 ? state : null);
    } catch (err) {
      return res.status(200).json(null);
    }
  }

  if (req.method === 'POST') {
    let attempts = 0;
    while (attempts < 3) {
      try {
        const { key } = req.query;
        let state = await readState();

        if (key) {
          state[key] = req.body;
        } else {
          state = req.body && typeof req.body === 'object' ? req.body : state;
        }

        await writeState(state);
        return res.status(200).json({ success: true });
      } catch (err) {
        if (attempts < 2) {
          attempts++;
          await new Promise(r => setTimeout(r, 150 * attempts));
          continue;
        }
        return res.status(500).json({ success: false, error: err.message });
      }
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
