import crypto from 'crypto';
import { get, put } from '@vercel/blob';

const REGISTRY_BLOB = 'system/users.json';
const HASH_VERSION = 'v1';

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
// LOAD REGISTRY (FIXED FOR VERCEL BLOB)
// =====================
async function loadRegistry() {
  try {
    console.log('📦 Loading blob...');

    const blob = await get(REGISTRY_BLOB);

    if (!blob) {
      console.log('⚠️ Blob not found');
      return {};
    }

    const text = await blob.text();

    console.log('📄 Raw blob:', text);

    if (!text) return {};

    const data = JSON.parse(text);

    console.log('✅ Users loaded:', Object.keys(data));

    return data;
  } catch (err) {
    console.log('❌ LOAD ERROR:', err.message);
    return {};
  }
}

// =====================
// SAVE REGISTRY
// =====================
async function saveRegistry(data) {
  console.log('💾 Saving users:', Object.keys(data));

  await put(REGISTRY_BLOB, JSON.stringify(data, null, 2), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true
  });

  console.log('✅ Saved successfully');
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
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { action } = req.query;
  const { username, password } = req.body || {};

  console.log('🚀 REQUEST:', { action, username });

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password required'
    });
  }

  const safeUsername = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);

  const safePassword = password.trim();

  console.log('🔐 NORMALIZED:', { safeUsername });

  try {
    const registry = await loadRegistry();

    const hashed = hashPassword(safeUsername, safePassword);

    console.log('🔑 HASH:', hashed);

    // =====================
    // REGISTER
    // =====================
    if (action === 'register') {
      console.log('🟢 REGISTER');

      if (registry[safeUsername]) {
        return res.status(409).json({
          success: false,
          error: 'Username already exists'
        });
      }

      registry[safeUsername] = {
        hash: hashed,
        version: HASH_VERSION,
        created: new Date().toISOString()
      };

      await saveRegistry(registry);

      return res.json({
        success: true,
        userId: safeUsername
      });
    }

    // =====================
    // LOGIN
    // =====================
    if (action === 'login') {
      console.log('🔵 LOGIN');

      console.log('🔎 Searching user:', safeUsername);
      console.log('📚 Users:', Object.keys(registry));

      const user = registry[safeUsername];

      if (!user) {
        console.log('❌ USER NOT FOUND');
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      const hashedInput = hashPassword(
        safeUsername,
        safePassword,
        user.version || HASH_VERSION
      );

      console.log('🔍 Stored:', user.hash);
      console.log('🔍 Input:', hashedInput);

      if (user.hash !== hashedInput) {
        console.log('❌ WRONG PASSWORD');
        return res.status(401).json({
          success: false,
          error: 'Invalid password'
        });
      }

      console.log('✅ LOGIN SUCCESS');

      return res.json({
        success: true,
        userId: safeUsername
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid action'
    });

  } catch (err) {
    console.log('🔥 FATAL:', err.message);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}