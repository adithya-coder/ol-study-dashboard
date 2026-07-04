import crypto from 'crypto';
import { get, put } from '@vercel/blob';

const HASH_VERSION = 'v1';
const REGISTRY_BLOB = 'system/users.json';

// =====================
// HASH FUNCTION
// =====================
function hashPassword(username, password, version = HASH_VERSION) {
  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  return crypto
    .createHash('sha256')
    .update(`${version}:${cleanUser}:${cleanPass}`)
    .digest('hex');
}

// =====================
// LOAD USERS
// =====================
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

// =====================
// SAVE USERS
// =====================
async function saveRegistry(data) {
  await put(REGISTRY_BLOB, JSON.stringify(data, null, 2), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true
  });
}

// =====================
// MAIN HANDLER
// =====================
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  const { action } = req.query;
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password required'
    });
  }

  // =====================
  // CLEAN INPUT (IMPORTANT)
  // =====================
  const safeUsername = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);

  const safePassword = password.trim();

  if (!safeUsername || !safePassword) {
    return res.status(400).json({
      success: false,
      error: 'Invalid username or password'
    });
  }

  try {
    const registry = await loadRegistry();

    // =====================
    // REGISTER
    // =====================
    if (action === 'register') {
      if (registry[safeUsername]) {
        return res.status(409).json({
          success: false,
          error: 'Username already exists'
        });
      }

      registry[safeUsername] = {
        hash: hashPassword(safeUsername, safePassword),
        version: HASH_VERSION,
        created: new Date().toISOString()
      };

      await saveRegistry(registry);

      return res.json({
        success: true,
        userId: safeUsername,
        username: safeUsername
      });
    }

    // =====================
    // LOGIN
    // =====================
    if (action === 'login') {
      const user = registry[safeUsername];

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      const hashed = hashPassword(
        safeUsername,
        safePassword,
        user.version || HASH_VERSION
      );

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