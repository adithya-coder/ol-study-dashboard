// Vercel Serverless Function: /api/state
// Uses Upstash Redis for persistent storage on Vercel
// Falls back to in-memory if Redis not configured

let memoryState = null;

async function getRedis() {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { Redis } = await import('@upstash/redis');
      return new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN
      });
    }
  } catch (e) {}
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const redis = await getRedis();

  if (req.method === 'GET') {
    try {
      if (redis) {
        const state = await redis.get('app_state');
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
        // Save single module
        let state = {};
        if (redis) {
          state = (await redis.get('app_state')) || {};
        } else {
          state = memoryState || {};
        }
        state[key] = body;
        if (redis) await redis.set('app_state', state);
        memoryState = state;
      } else {
        // Save full state
        if (redis) await redis.set('app_state', body);
        memoryState = body;
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
