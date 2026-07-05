import { query } from '../db/index.js';

export async function getBillingRecords(userId) {
  const result = await query(
    `SELECT id, type, amount_eur, period_start, period_end, status, invoice_number, created_at
     FROM billing_records
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

export async function createBillingRecord(userId, data) {
  const result = await query(
    `INSERT INTO billing_records (user_id, type, amount_eur, period_start, period_end, status, invoice_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      data.type,
      data.amount_eur,
      data.period_start,
      data.period_end,
      data.status || 'draft',
      data.invoice_number,
    ]
  );

  return result.rows[0];
}
