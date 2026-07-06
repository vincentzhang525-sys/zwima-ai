const fs = require("fs");
const path = require("path");

const TABLES = [
  "profiles",
  "credit_wallets",
  "credit_transactions",
  "usage_records",
  "api_keys",
  "playground_conversations",
];

function getMigrationsDir() {
  const candidates = [
    path.join(process.cwd(), "supabase", "migrations"),
    path.join(__dirname, "..", "..", "supabase", "migrations"),
    path.join("/var/task", "supabase", "migrations"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

function listMigrationFiles() {
  const dir = getMigrationsDir();
  if (dir) {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((name) => ({ name, path: path.join(dir, name) }));
  }

  const bundled = path.join(__dirname, "migrationSql.js");
  if (fs.existsSync(bundled)) {
    const { MIGRATIONS } = require("./migrationSql");
    return MIGRATIONS.map((item) => ({ name: item.name, sql: item.sql }));
  }

  const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");
  if (fs.existsSync(schemaPath)) {
    return [{ name: "schema.sql", path: schemaPath }];
  }

  const { MIGRATIONS } = require("./migrationSql");
  return MIGRATIONS.map((item) => ({ name: item.name, sql: item.sql }));
}

function readSql(file) {
  if (file.sql) return file.sql;
  return fs.readFileSync(file.path, "utf8");
}

function getProjectRef(supabaseUrl) {
  return String(supabaseUrl || "").match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";
}

function getDatabaseUrlCandidates() {
  const candidates = [];
  const push = (value, via) => {
    if (value) candidates.push({ url: value, via });
  };

  push(process.env.DATABASE_URL, "DATABASE_URL");
  push(process.env.SUPABASE_DB_URL, "SUPABASE_DB_URL");
  push(process.env.POSTGRES_URL, "POSTGRES_URL");
  push(process.env.POSTGRES_URL_NON_POOLING, "POSTGRES_URL_NON_POOLING");

  const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  const ref = getProjectRef(process.env.SUPABASE_URL);
  const host = process.env.POSTGRES_HOST;
  const user = process.env.POSTGRES_USER || "postgres";
  const database = process.env.POSTGRES_DATABASE || "postgres";
  const port = process.env.POSTGRES_PORT || "5432";

  if (password && host) {
    push(
      `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`,
      "POSTGRES_HOST"
    );
  }

  if (password && ref) {
    const regions = [
      "aws-1-eu-central-1",
      "aws-0-eu-central-1",
      "aws-0-eu-west-1",
      "aws-0-eu-west-2",
      "aws-0-eu-west-3",
      "aws-0-us-east-1",
      "aws-0-us-west-1",
      "aws-0-ap-southeast-1",
      "aws-0-ap-northeast-1",
    ];
    for (const region of regions) {
      push(
        `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${region}.pooler.supabase.com:6543/postgres`,
        `pooler-${region}`
      );
      push(
        `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${region}.pooler.supabase.com:5432/postgres`,
        `pooler-session-${region}`
      );
    }
    push(
      `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`,
      "SUPABASE_DB_PASSWORD"
    );
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey && ref) {
    const regions = ["aws-1-eu-central-1", "aws-0-eu-central-1", "aws-0-us-east-1"];
    for (const region of regions) {
      push(
        `postgresql://postgres.${ref}:${encodeURIComponent(serviceKey)}@${region}.pooler.supabase.com:6543/postgres`,
        `service-role-${region}`
      );
    }
  }

  return candidates;
}

async function tryManagementApi(sql, token, ref) {
  const attempts = [
    { url: `https://api.supabase.com/v1/projects/${ref}/database/query`, headers: { Authorization: `Bearer ${token}` } },
    { url: `https://api.supabase.com/v1/projects/${ref}/database/query`, headers: { apikey: token, Authorization: `Bearer ${token}` } },
  ];

  for (const attempt of attempts) {
    const res = await fetch(attempt.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...attempt.headers,
      },
      body: JSON.stringify({ query: sql }),
    });
    const payload = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, status: res.status, payload };
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const payload = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, payload };
}

async function applyWithPg(url, files) {
  let Client;
  try {
    Client = require("pg").Client;
  } catch (err) {
    return { applied: false, reason: `pg module unavailable: ${err.message}` };
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    for (const file of files) {
      await client.query(readSql(file));
    }
    return { applied: true, files: files.map((f) => f.name) };
  } finally {
    await client.end();
  }
}

async function applyMigrations() {
  const files = listMigrationFiles();
  const ref = getProjectRef(process.env.SUPABASE_URL);
  const errors = [];

  for (const candidate of getDatabaseUrlCandidates()) {
    try {
      const result = await applyWithPg(candidate.url, files);
      if (result.applied) return { ...result, via: candidate.via };
      errors.push(`${candidate.via}: ${result.reason}`);
    } catch (err) {
      errors.push(`${candidate.via}: ${err.message}`);
    }
  }

  const tokens = [
    process.env.SUPABASE_ACCESS_TOKEN,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].filter(Boolean);

  for (const token of tokens) {
    let tokenOk = true;
    for (const file of files) {
      const result = await tryManagementApi(readSql(file), token, ref);
      if (!result.ok) {
        errors.push(`management-api/${file.name}: ${result.payload?.message || result.status}`);
        tokenOk = false;
        break;
      }
    }
    if (tokenOk) {
      return { applied: true, via: "management-api", files: files.map((f) => f.name) };
    }
  }

  return {
    applied: false,
    reason: "No working database connection",
    errors,
    hint: "Add SUPABASE_DB_PASSWORD, DATABASE_URL, or SUPABASE_ACCESS_TOKEN to Vercel",
  };
}

async function tableExists(admin, table) {
  const { error } = await admin.from(table).select("*").limit(1);
  if (!error) return true;
  const message = String(error.message || "").toLowerCase();
  return !message.includes("does not exist") && !message.includes("schema cache");
}

async function verifyTables(admin) {
  const status = {};
  for (const table of TABLES) {
    status[table] = await tableExists(admin, table);
  }
  return status;
}

module.exports = {
  TABLES,
  listMigrationFiles,
  applyMigrations,
  verifyTables,
  tableExists,
};
