import { query } from '../db/index.js';

export async function getUsageRecords(userId, { limit = 50, offset = 0 } = {}) {
  const result = await query(
    `SELECT id, user_id, model, input_tokens, output_tokens, credits_used, latency_ms, status, created_at
     FROM usage_records
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const count = await query(
    'SELECT COUNT(*) FROM usage_records WHERE user_id = $1',
    [userId]
  );

  return {
    records: result.rows,
    total: parseInt(count.rows[0].count, 10),
  };
}

export async function getAllUsageRecords({ limit = 100, offset = 0 } = {}) {
  const result = await query(
    `SELECT ur.id, ur.user_id, u.company_name, u.email, ur.model,
            ur.input_tokens, ur.output_tokens, ur.credits_used, ur.status, ur.created_at
     FROM usage_records ur
     JOIN users u ON u.id = ur.user_id
     ORDER BY ur.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}
