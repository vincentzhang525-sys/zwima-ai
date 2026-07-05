import { query } from '../db/index.js';

export async function listUsers() {
  const result = await query(
    `SELECT u.id, u.company_name, u.email, u.status, u.credit_balance, u.monthly_quota,
            u.is_admin, u.created_at,
            (SELECT COUNT(*) FROM api_keys ak WHERE ak.user_id = u.id AND ak.status = 'active') AS active_keys
     FROM users u
     ORDER BY u.created_at DESC`
  );
  return result.rows;
}

export async function listAllApiKeys() {
  const result = await query(
    `SELECT ak.id, ak.user_id, u.company_name, u.email, ak.name, ak.key_prefix,
            ak.env, ak.status, ak.created_at, ak.last_used_at
     FROM api_keys ak
     JOIN users u ON u.id = ak.user_id
     ORDER BY ak.created_at DESC`
  );
  return result.rows;
}

export async function listAllBilling() {
  const result = await query(
    `SELECT br.id, br.user_id, u.company_name, u.email, br.type, br.amount_eur,
            br.period_start, br.period_end, br.status, br.invoice_number, br.created_at
     FROM billing_records br
     JOIN users u ON u.id = br.user_id
     ORDER BY br.created_at DESC`
  );
  return result.rows;
}

export async function getStats() {
  const result = await query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM api_keys WHERE status = 'active') AS active_api_keys,
      (SELECT COALESCE(SUM(credits_used), 0) FROM usage_records) AS total_credits_used,
      (SELECT COUNT(*) FROM usage_records WHERE created_at > NOW() - INTERVAL '24 hours') AS requests_24h
  `);
  return result.rows[0];
}
