// Vercel Serverless Function: GET /api/state and POST /api/state
// Uses Vercel KV (Redis) for persistent storage
// If KV not configured, falls back to in-memory (resets on cold start)

let memoryState = null; // Fallback in-memory storage

export default async function handler(req, res) {
  // Try to use Vercel KV if available
  let kv = null;
  try {
    const { kv: kvStore } = await import('@vercel/kv');
    kv = kvStore;
  } catch (e) {
    // KV not available, use memory
  }

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
      const body = req.body;
      if (kv) {
        await kv.set('app_state', body);
      }
      memoryState = body;
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
