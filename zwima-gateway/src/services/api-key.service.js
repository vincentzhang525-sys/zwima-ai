import { query } from '../db/index.js';
import { generateApiKey, hashApiKey } from '../utils/crypto.js';

const MAX_KEYS_PER_USER = 3;

export async function createApiKey(userId, { name, env = 'live' }) {
  const count = await query(
    "SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND status = 'active'",
    [userId]
  );

  if (parseInt(count.rows[0].count, 10) >= MAX_KEYS_PER_USER) {
    const err = new Error('Maximum active API keys reached');
    err.statusCode = 400;
    throw err;
  }

  const { rawKey, keyPrefix, keyHash } = generateApiKey(env);

  const result = await query(
    `INSERT INTO api_keys (user_id, name, key_prefix, key_hash, env)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, key_prefix, env, status, created_at`,
    [userId, name, keyPrefix, keyHash, env]
  );

  return { ...result.rows[0], api_key: rawKey };
}

export async function listApiKeys(userId) {
  const result = await query(
    `SELECT id, name, key_prefix, env, status, created_at, last_used_at
     FROM api_keys
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function resolveApiKey(bearerToken) {
  if (!bearerToken?.startsWith('zwima_sk_')) {
    return null;
  }

  const keyHash = hashApiKey(bearerToken);

  const result = await query(
    `SELECT ak.id AS api_key_id, ak.user_id, ak.status AS key_status,
            u.status AS user_status, u.credit_balance, u.monthly_quota, u.company_name
     FROM api_keys ak
     JOIN users u ON u.id = ak.user_id
     WHERE ak.key_hash = $1`,
    [keyHash]
  );

  const row = result.rows[0];
  if (!row || row.key_status !== 'active' || row.user_status !== 'active') {
    return null;
  }

  await query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.api_key_id]);
  return row;
}

export async function revokeApiKey(userId, keyId) {
  const result = await query(
    `UPDATE api_keys SET status = 'revoked'
     WHERE id = $1 AND user_id = $2 AND status = 'active'
     RETURNING id`,
    [keyId, userId]
  );

  if (result.rows.length === 0) {
    const err = new Error('API key not found');
    err.statusCode = 404;
    throw err;
  }

  return { revoked: true };
}
