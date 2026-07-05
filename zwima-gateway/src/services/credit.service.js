import { query } from '../db/index.js';

export async function getCreditBalance(userId) {
  const result = await query(
    'SELECT credit_balance, monthly_quota FROM users WHERE id = $1',
    [userId]
  );

  if (!result.rows[0]) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const { credit_balance, monthly_quota } = result.rows[0];
  return {
    credit_balance,
    monthly_quota,
    used_credits: monthly_quota - credit_balance,
    remaining_credits: credit_balance,
  };
}

export async function getCreditTransactions(userId, { limit = 50 } = {}) {
  const result = await query(
    `SELECT id, type, amount, balance_after, description, created_at
     FROM credit_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}
