import bcrypt from 'bcrypt';
import pg from 'pg';

async function seed() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@zwima.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
  const hash = await bcrypt.hash(adminPassword, 12);

  await pool.query(
    `INSERT INTO users (company_name, email, password_hash, is_admin, credit_balance, monthly_quota)
     VALUES ($1, $2, $3, TRUE, 100000, 100000)
     ON CONFLICT (email) DO UPDATE SET is_admin = TRUE, password_hash = EXCLUDED.password_hash`,
    ['Zwima Admin', adminEmail, hash]
  );

  console.log(`Admin user ready: ${adminEmail}`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
