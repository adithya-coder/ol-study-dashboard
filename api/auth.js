import crypto from 'crypto';
import { get, put } from '@vercel/blob';

const HASH_VERSION = 'v1';
const REGISTRY_BLOB = 'system/users.json';

// =====================
// HASH
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
// LOAD REGISTRY (WITH LOGS)
// =====================
async function loadRegistry() {
  try {
    console.log('📦 [LOAD] Fetching blob:', REGISTRY_BLOB);

    const blob = await get(REGISTRY_BLOB);

    if (!blob) {
      console.log('⚠️ [LOAD] Blob is NULL');
      return {};
    }

    const text = await blob.text();

    console.log('📄 [LOAD] Raw blob text:', text);

    if (!text) {
      console.log('⚠️ [LOAD] Blob is EMPTY');
      return {};
    }

    const parsed = JSON.parse(text);

    console.log('✅ [LOAD] Parsed registry keys:', Object.keys(parsed));

    return parsed;
  } catch (err) {
    console.log('❌ [LOAD ERROR]', err.message);
    return {};
  }
}

// =====================
// SAVE REGISTRY (WITH LOGS)
// =====================
async function saveRegistry(data) {
  console.log('💾 [SAVE] Saving users:', Object.keys(data));

  await put(REGISTRY_BLOB, JSON.stringify(data, null, 2), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true
  });

  console.log('✅ [SAVE] Saved successfully');
}

// =====================
// HANDLER
// =====================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { action } = req.query;
  const { username, password } = req.body || {};

  console.log('🚀 [REQUEST]', { action, username });

  if (!username || !password) {
    console.log('❌ Missing credentials');
    return res.status(400).json({ error: 'Username and password required' });
  }

  const safeUsername = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);

  const safePassword = password.trim();

  console.log('🔐 [NORMALIZED]', {
    raw: username,
    safeUsername,
    passwordLength: safePassword.length
  });

  try {
    const registry = await loadRegistry();

    const hashed = hashPassword(safeUsername, safePassword);

    console.log('🔑 [HASH]', hashed);

    // =====================
    // REGISTER
    // =====================
    if (action === 'register') {
      console.log('🟢 REGISTER FLOW');

      if (registry[safeUsername]) {
        console.log('⚠️ User already exists');
        return res.status(409).json({ error: 'Username already exists' });
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
      console.log('🔵 LOGIN FLOW');

      console.log('🔎 Looking for user:', safeUsername);
      console.log('📚 Available users:', Object.keys(registry));

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

      console.log('🔍 Stored hash:', user.hash);
      console.log('🔍 Input hash:', hashedInput);

      if (user.hash !== hashedInput) {
        console.log('❌ PASSWORD MISMATCH');
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

    return res.status(400).json({ error: 'Invalid action' });

  } catch (err) {
    console.log('🔥 FATAL ERROR:', err);
    return res.status(500).json({ error: err.message });
  }
}