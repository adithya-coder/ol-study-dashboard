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
    // 1. Find all files starting with 'app-state.json'
    const { blobs } = await blob.list({ prefix: BLOB_NAME, token });
    
    if (blobs.length > 0) {
      // 2. SORT BY NEWEST FIRST (Bypasses oldest file trap)
      const sortedBlobs = blobs.sort(
        (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
      );
      
      const latestBlob = sortedBlobs[0]; // This is your actual latest state!

      // 3. BYPASS CDN CACHE (Forces Vercel to download fresh data)
      const freshUrl = `${latestBlob.downloadUrl}?t=${Date.now()}`;
      const response = await fetch(freshUrl, {
  method: 'GET',
  mode: 'cors', // 👈 Explicitly request CORS access
  headers: {
    'Accept': 'application/json',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  }
});
      
      if (response.ok) {
        const data = await response.json();
        
        // 4. Validate and deliver the object
        if (data && typeof data === 'object') {
          return data;
        }
      }
    }
  } catch (e) {
    console.error('[readState] Error:', e.message);
  }
  return {}; // Safely fall back to an empty object if empty or failed
}

  // Helper: write state to blob (overwrite, no delete needed)
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
