// Vercel Serverless Function: /api/state
// Uses Vercel Blob for persistent JSON storage

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let blob = null;
  try {
    blob = await import('@vercel/blob');
  } catch (e) {}

  const BLOB_NAME = 'app-state.json';

  if (req.method === 'GET') {
    try {
      if (blob && process.env.BLOB_READ_WRITE_TOKEN) {
        const { blobs } = await blob.list({ prefix: BLOB_NAME });
        if (blobs.length > 0) {
          const response = await fetch(blobs[0].downloadUrl);
          const data = await response.json();
          return res.status(200).json(data);
        }
      }
      return res.status(200).json(null);
    } catch (err) {
      console.error('[API GET]', err.message);
      return res.status(200).json(null);
    }
  }

  if (req.method === 'POST') {
    try {
      const { key } = req.query;
      let state = {};

      // Load existing state
      if (blob && process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          const { blobs } = await blob.list({ prefix: BLOB_NAME });
          if (blobs.length > 0) {
            const response = await fetch(blobs[0].url);
            state = await response.json();
            if (!state || typeof state !== 'object' || Array.isArray(state)) {
              state = {};
            }
          }
        } catch (e) {}
      }

      // Update state
      if (key) {
        state[key] = req.body;
      } else {
        state = req.body;
      }

      // Save to blob
      if (blob && process.env.BLOB_READ_WRITE_TOKEN) {
        // Delete old blob first
        try {
          const { blobs } = await blob.list({ prefix: BLOB_NAME });
          if (blobs.length > 0) {
            await blob.del(blobs.map(b => b.url));
          }
        } catch (e) {}

        // Upload new state
        await blob.put(BLOB_NAME, JSON.stringify(state), {
          access: 'private',
          contentType: 'application/json',
          addRandomSuffix: false
        });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[API POST]', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
