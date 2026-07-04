// /api/auth (Vercel Serverless Function)

import crypto from 'crypto';
import { put, get } from '@vercel/blob';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.query;
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password required'
    });
  }

  const safeUsername = username
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 32)
    .toLowerCase();

  if (!safeUsername) {
    return res.status(400).json({
      success: false,
      error: 'Invalid username'
    });
  }

  const REGISTRY_BLOB = 'system/users.json';

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
    } catch {
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
    const hashed = hashPassword(safeUsername, password);

    // REGISTER
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

      return res.status(200).json({
        success: true,
        userId: safeUsername,
        username: safeUsername
      });
    }

    // LOGIN
    if (action === 'login') {
      const user = registry[safeUsername];

      if (!user || user.hash !== hashed) {
        return res.status(401).json({
          success: false,
          error: 'Invalid username or password'
        });
      }

      return res.status(200).json({
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
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}