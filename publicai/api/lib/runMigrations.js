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

const POOLER_REGIONS = [
  "aws-0-eu-west-3",
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

function extractRawPassword(url) {
  const raw = String(url).trim().replace(/^["']|["']$/g, "");
  const withoutQuery = raw.split("?")[0];
  const match = withoutQuery.match(/^postgres(?:ql)?:\/\/(?:[^:@/]+)(?::([^@]*))?@/i);
  return match?.[1] ?? "";
}

function parsePgUrl(url) {
  try {
    const raw = String(url).trim().replace(/^["']|["']$/g, "");
    const query = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
    const normalized = raw.split("?")[0].replace(/^postgres:\/\//, "postgresql://");
    const parsed = new URL(normalized);
    const rawPassword = extractRawPassword(raw);
    const password = rawPassword || decodeURIComponent(parsed.password || "");
    const username = decodeURIComponent(parsed.username || "");
    const host = parsed.hostname;
    const port = parsed.port || "5432";
    const database = (parsed.pathname || "/postgres").replace(/^\//, "") || "postgres";

    let ref = getProjectRef(process.env.SUPABASE_URL);
    const dbMatch = host.match(/^db\.([^.]+)\.supabase\.co$/);
    if (dbMatch) ref = dbMatch[1];
    const userMatch = username.match(/^postgres\.(.+)$/);
    if (userMatch) ref = userMatch[1];

    const poolerRegion = host.match(/^(aws-[01]-[a-z]+-[a-z]+-\d+)\.pooler\.supabase\.com$/)?.[1] || "";

    return { password, username, host, port, database, ref, query, poolerRegion };
  } catch {
    return null;
  }
}

function normalizePoolerQuery(query, port) {
  if (!query) return "";
  if (port !== "5432") return query;
  const params = new URLSearchParams(query.replace(/^\?/, ""));
  params.delete("pgbouncer");
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

function buildPoolerUrl(info, region, port, passwordOverride) {
  const user = info.username?.includes(".") ? info.username : `postgres.${info.ref}`;
  const host = `${region}.pooler.supabase.com`;
  const encoded = passwordOverride ?? encodeURIComponent(info.password);
  const query = normalizePoolerQuery(info.query, String(port));
  return `postgresql://${user}:${encoded}@${host}:${port}/${info.database}${query}`;
}

function buildPoolerSessionUrls(ref, password, database = "postgres", query = "") {
  const info = { username: `postgres.${ref}`, password, ref, database, query };
  const urls = [];
  for (const region of POOLER_REGIONS) {
    urls.push({
      url: buildPoolerUrl(info, region, "5432"),
      via: `pooler-session-${region}`,
    });
  }
  return urls;
}

function passwordVariants(url) {
  const raw = extractRawPassword(url);
  const info = parsePgUrl(url);
  const variants = new Set();
  if (info?.password) variants.add(info.password);
  if (raw) {
    variants.add(raw);
    try {
      variants.add(decodeURIComponent(raw));
    } catch {
      /* keep raw only */
    }
  }
  return [...variants].filter(Boolean);
}

function expandDatabaseUrl(url, via) {
  const candidates = [];
  const seen = new Set();
  const addFirst = (candidateUrl, candidateVia) => {
    if (!candidateUrl || seen.has(candidateUrl)) return;
    seen.add(candidateUrl);
    candidates.unshift({ url: candidateUrl, via: candidateVia });
  };
  const add = (candidateUrl, candidateVia) => {
    if (!candidateUrl || seen.has(candidateUrl)) return;
    seen.add(candidateUrl);
    candidates.push({ url: candidateUrl, via: candidateVia });
  };

  const info = parsePgUrl(url);
  if (!info) {
    add(url, via);
    return candidates;
  }

  const isDirect = /^db\.[^.]+\.supabase\.co$/.test(info.host);
  const isPooler = info.host.endsWith(".pooler.supabase.com");

  if (isPooler) {
    const region = info.poolerRegion || "aws-0-eu-west-3";
    for (const pass of passwordVariants(url)) {
      const variantInfo = { ...info, password: pass };
      const raw = extractRawPassword(url);
      const encodedOverride = raw && pass === raw ? raw : undefined;
      addFirst(
        buildPoolerUrl(variantInfo, region, "5432", encodedOverride),
        `${via}-session-${region}-v`
      );
      if (info.port === "6543") {
        addFirst(
          buildPoolerUrl(variantInfo, region, "6543", encodedOverride),
          `${via}-tx-${region}-v`
        );
      }
    }
    if (info.port === "6543") {
      addFirst(buildPoolerUrl(info, region, "5432"), `${via}-session-port`);
      const sessionRaw = url
        .replace(":6543/", ":5432/")
        .replace(":6543", ":5432")
        .replace(/\?pgbouncer=true&?/i, "?")
        .replace(/\?&/, "?")
        .replace(/\?$/, "");
      addFirst(sessionRaw, `${via}-session-port-raw`);
    } else {
      addFirst(url, via);
    }
  }

  if (info.password && info.ref) {
    const regions = info.poolerRegion
      ? [info.poolerRegion, ...POOLER_REGIONS.filter((r) => r !== info.poolerRegion)]
      : POOLER_REGIONS;
    const rawPassword = extractRawPassword(url);
    for (const region of regions) {
      add(buildPoolerUrl(info, region, "5432"), `${via}-pooler-session-${region}`);
      if (rawPassword && rawPassword !== encodeURIComponent(info.password)) {
        add(
          buildPoolerUrl(info, region, "5432", rawPassword),
          `${via}-pooler-session-${region}-raw-pass`
        );
      }
    }
    if (regions[0]) {
      addFirst(buildPoolerUrl(info, regions[0], "5432"), `${via}-pooler-session-${regions[0]}-priority`);
    }
  }

  if (!isDirect) {
    add(url, via);
  } else {
    add(url, `${via}-direct`);
  }

  return candidates;
}

function getDatabaseUrlCandidates() {
  const candidates = [];
  const seen = new Set();
  const push = (value, via) => {
    if (!value) return;
    for (const item of expandDatabaseUrl(value, via)) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      candidates.push(item);
    }
  };

  const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  const ref = getProjectRef(process.env.SUPABASE_URL);

  if (password && ref) {
    const region = "aws-0-eu-west-3";
    push(
      `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${region}.pooler.supabase.com:5432/postgres`,
      "SUPABASE_DB_PASSWORD-session"
    );
    push(
      `postgresql://postgres.${ref}:${password}@${region}.pooler.supabase.com:5432/postgres`,
      "SUPABASE_DB_PASSWORD-session-raw"
    );
  }

  push(process.env.DIRECT_URL, "DIRECT_URL");
  push(process.env.DATABASE_URL, "DATABASE_URL");
  push(process.env.SUPABASE_DB_URL, "SUPABASE_DB_URL");
  push(process.env.POSTGRES_URL, "POSTGRES_URL");
  push(process.env.POSTGRES_URL_NON_POOLING, "POSTGRES_URL_NON_POOLING");

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
    for (const pooler of buildPoolerSessionUrls(ref, password, database)) {
      push(pooler.url, pooler.via);
    }
    push(
      `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/${database}`,
      "SUPABASE_DB_PASSWORD-direct"
    );
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

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
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
    hint:
      "Use session pooler for migrations: postgresql://postgres.[ref]:[password]@aws-0-eu-west-3.pooler.supabase.com:5432/postgres (direct db.* host is IPv6-only and fails on Vercel). Reset DB password to alphanumeric if pooler auth fails.",
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
  parsePgUrl,
  getConnectionDebugInfo() {
    const info = parsePgUrl(process.env.DATABASE_URL || "");
    if (!info) return { parsed: false };
    const ref = info.ref || getProjectRef(process.env.SUPABASE_URL);
    return {
      parsed: true,
      host: info.host,
      port: info.port,
      username: info.username,
      ref,
      poolerRegion: info.poolerRegion || "aws-0-eu-west-3",
      passwordLength: info.password?.length || 0,
      isPooler: info.host.endsWith(".pooler.supabase.com"),
      isDirect: /^db\.[^.]+\.supabase\.co$/.test(info.host),
      issue: /^db\.[^.]+\.supabase\.co$/.test(info.host)
        ? "Direct db.* host is IPv6-only and unreachable from Vercel. Use session pooler on port 5432."
        : null,
      recommendedMigrationUrl: ref
        ? `postgresql://postgres.${ref}:[PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:5432/postgres`
        : null,
    };
  },
};
