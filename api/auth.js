// /api/auth - FIXED VERSION

import crypto from 'crypto';
import { get, put } from '@vercel/blob';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { action } = req.query;
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password required'
    });
  }

  // ✅ STRICT normalization (IMPORTANT FIX)
  const safeUsername = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);

  const safePassword = password.trim();

  if (!safeUsername || !safePassword) {
    return res.status(400).json({
      success: false,
      error: 'Invalid username or password format'
    });
  }

  const REGISTRY_BLOB = 'system/users.json';

  // ✅ FIXED HASH (MUST MATCH BOTH SIDES EXACTLY)
  function hashPassword(user, pass) {
    return crypto
      .createHash('sha256')
      .update(`${user}:${pass}`)
      .digest('hex');
  }

  async function loadRegistry() {
    try {
      const blob = await get(REGISTRY_BLOB);
      if (!blob) return {};

      const text = await blob.text();
      return text ? JSON.parse(text) : {};
    } catch (err) {
      console.log('[loadRegistry error]', err.message);
      return {};
    }
  }

  async function saveRegistry(data) {
    await put(REGISTRY_BLOB, JSON.stringify(data, null, 2), {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true
    });
  }

  try {
    const registry = await loadRegistry();

    const hashed = hashPassword(safeUsername, safePassword);

    console.log('[AUTH]', action);
    console.log('User:', safeUsername);
    console.log('Hash:', hashed);

    // =========================
    // REGISTER
    // =========================
    if (action === 'register') {
      if (registry[safeUsername]) {
        return res.status(409).json({
          success: false,
          error: 'Username already exists'
        });
      }

      registry[safeUsername] = {
        hash: hashed,
        created: new Date().toISOString()
      };

      await saveRegistry(registry);

      return res.json({
        success: true,
        userId: safeUsername,
        username: safeUsername
      });
    }

    // =========================
    // LOGIN
    // =========================
    if (action === 'login') {
      const user = registry[safeUsername];

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      if (user.hash !== hashed) {
        return res.status(401).json({
          success: false,
          error: 'Invalid password'
        });
      }

      return res.json({
        success: true,
        userId: safeUsername,
        username: safeUsername
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid action'
    });

  } catch (err) {
    console.error('[AUTH ERROR]', err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}