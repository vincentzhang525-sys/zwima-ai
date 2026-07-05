import { pool } from '../db/index.js';
import { calculateCredits } from '../utils/crypto.js';
import { config } from '../config.js';

export async function deductCreditsWithUsage({
  userId,
  apiKeyId,
  model,
  inputTokens,
  outputTokens,
  latencyMs,
  status = 'success',
}) {
  const creditsUsed = status === 'success'
    ? calculateCredits(inputTokens, outputTokens, model, config.modelFactors)
    : 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (creditsUsed > 0) {
      const deduct = await client.query(
        `UPDATE users
         SET credit_balance = credit_balance - $1, updated_at = NOW()
         WHERE id = $2 AND credit_balance >= $1
         RETURNING credit_balance`,
        [creditsUsed, userId]
      );

      if (deduct.rows.length === 0) {
        const err = new Error('Insufficient credits');
        err.statusCode = 429;
        err.type = 'quota_exceeded';
        throw err;
      }
    }

    const usage = await client.query(
      `INSERT INTO usage_records
         (user_id, api_key_id, model, input_tokens, output_tokens, credits_used, latency_ms, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, model, input_tokens, output_tokens, credits_used, created_at`,
      [userId, apiKeyId, model, inputTokens, outputTokens, creditsUsed, latencyMs, status]
    );

    if (creditsUsed > 0) {
      const balance = await client.query(
        'SELECT credit_balance FROM users WHERE id = $1',
        [userId]
      );

      await client.query(
        `INSERT INTO credit_transactions
           (user_id, type, amount, balance_after, usage_record_id, description)
         VALUES ($1, 'deduction', $2, $3, $4, $5)`,
        [
          userId,
          -creditsUsed,
          balance.rows[0].credit_balance,
          usage.rows[0].id,
          `API usage: ${model}`,
        ]
      );
    }

    await client.query('COMMIT');
    return usage.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function topupCredits(userId, amount, description = 'Admin top-up') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updated = await client.query(
      `UPDATE users
       SET credit_balance = credit_balance + $1, updated_at = NOW()
       WHERE id = $2
       RETURNING credit_balance`,
      [amount, userId]
    );

    if (updated.rows.length === 0) {
      throw new Error('User not found');
    }

    await client.query(
      `INSERT INTO credit_transactions (user_id, type, amount, balance_after, description)
       VALUES ($1, 'topup', $2, $3, $4)`,
      [userId, amount, updated.rows[0].credit_balance, description]
    );

    await client.query('COMMIT');
    return updated.rows[0].credit_balance;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
