import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  const maxRetries = 30;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await pool.query(schema);
      console.log('Database migration completed.');
      await pool.end();
      return;
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      console.log(`Waiting for database... (${i + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
