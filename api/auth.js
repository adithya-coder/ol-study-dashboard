// Vercel Serverless Function: /api/auth
// Stores user registry in a single blob, reads it server-side with full token

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return res.status(500).json({ success: false, error: 'Storage not configured' });

  let blob;
  try {
    blob = await import('@vercel/blob');
  } catch (e) {
    return res.status(500).json({ success: false, error: 'blob module unavailable' });
  }

  const { action } = req.query;
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' });
  }

  const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32).toLowerCase();
  if (!safeUsername) return res.status(400).json({ success: false, error: 'Invalid username' });

  const REGISTRY_BLOB = 'system/users.json';

  // Hash using pure JS — deterministic across all Node.js versions
  function hashPassword(pass) {
    const str = safeUsername + ':' + pass + ':ol2026';
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  async function loadRegistry() {
    try {
      const { blobs } = await blob.list({ prefix: REGISTRY_BLOB, token });
      console.log('[loadRegistry] blobs found:', blobs.length, 'for prefix:', REGISTRY_BLOB);
      if (blobs.length > 0) {
        const signedUrl = await blob.presignUrl(blobs[0].url, { token, operation: 'get', expiresIn: 60 });
        const response = await fetch(signedUrl);
        console.log('[loadRegistry] fetch status:', response.status);
        if (response.ok) {
          const text = await response.text();
          if (text) return JSON.parse(text);
        }
      }
    } catch (e) {
      console.error('[loadRegistry error]', e.message);
    }
    return {};
  }

  async function saveRegistry(registry) {
    await blob.put(REGISTRY_BLOB, JSON.stringify(registry), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      token
    });
  }

  try {
    const registry = await loadRegistry();
    const hashed = hashPassword(password);

    console.log('[auth]', action, safeUsername, 'computed hash:', hashed, 'registry users:', Object.keys(registry));

    if (action === 'register') {
      if (registry[safeUsername]) {
        return res.status(409).json({ success: false, error: 'Username already exists' });
      }
      registry[safeUsername] = { hash: hashed, created: new Date().toISOString() };
      await saveRegistry(registry);
      return res.status(200).json({ success: true, userId: safeUsername, username: safeUsername });
    }

    if (action === 'login') {
      const user = registry[safeUsername];
      if (!user || user.hash !== hashed) {
        console.log('[auth] login fail - stored hash:', user?.hash, 'computed:', hashed);
        return res.status(401).json({ success: false, error: 'Invalid username or password' });
      }
      return res.status(200).json({ success: true, userId: safeUsername, username: safeUsername });
    }

    return res.status(400).json({ success: false, error: 'Invalid action' });
  } catch (err) {
    console.error('[auth error]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
