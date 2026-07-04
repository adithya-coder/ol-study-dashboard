// Vercel Serverless Function: /api/auth
// POST /api/auth?action=register  — create account
// POST /api/auth?action=login     — login and return userId

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ success: false, error: 'Storage not configured' });
  }

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

  // Sanitize username
  const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32).toLowerCase();
  if (!safeUsername) {
    return res.status(400).json({ success: false, error: 'Invalid username' });
  }

  const USERS_BLOB = 'users/registry.json';

  // Load user registry
  async function loadRegistry() {
    try {
      const { blobs } = await blob.list({ prefix: USERS_BLOB, token });
      if (blobs.length > 0) {
        const response = await fetch(blobs[0].downloadUrl);
        if (response.ok) return await response.json();
      }
    } catch (e) {}
    return {};
  }

  // Save user registry
  async function saveRegistry(registry) {
    await blob.put(USERS_BLOB, JSON.stringify(registry), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      token
    });
  }

  // Simple but deterministic hash
  async function hashPassword(pass) {
    const str = pass + 'ol2026salt_' + safeUsername;
    let h1 = 0x9e3779b9, h2 = 0x6c62272e;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 0x9e3779b9);
      h2 = Math.imul(h2 ^ ch, 0x6c62272e);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 0x85ebca6b);
    h1 = Math.imul(h1 ^ (h1 >>> 13), 0xc2b2ae35);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 0x85ebca6b);
    h2 = Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35);
    return ((h1 ^ h2) >>> 0).toString(36) + (Math.abs(h1) >>> 0).toString(36);
  }

  try {
    const registry = await loadRegistry();
    const hashed = await hashPassword(password);

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
        return res.status(401).json({ success: false, error: 'Invalid username or password' });
      }
      return res.status(200).json({ success: true, userId: safeUsername, username: safeUsername });
    }

    return res.status(400).json({ success: false, error: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
