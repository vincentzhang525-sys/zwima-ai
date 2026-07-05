import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { config } from '../config.js';

export async function register({ companyName, email, password }) {
  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    `INSERT INTO users (company_name, email, password_hash, credit_balance, monthly_quota)
     VALUES ($1, $2, $3, $4, $4)
     RETURNING id, company_name, email, credit_balance, monthly_quota, created_at`,
    [companyName, email.toLowerCase(), passwordHash, config.defaultMonthlyQuota]
  );

  return result.rows[0];
}

export async function login({ email, password }) {
  const result = await query(
    'SELECT id, company_name, email, password_hash, status, credit_balance, monthly_quota FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  const user = result.rows[0];
  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  if (user.status !== 'active') {
    const err = new Error('Account is not active');
    err.statusCode = 403;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      company_name: user.company_name,
      email: user.email,
      credit_balance: user.credit_balance,
      monthly_quota: user.monthly_quota,
    },
  };
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}
