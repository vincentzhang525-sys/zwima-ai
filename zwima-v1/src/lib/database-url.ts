const POOLER_REGIONS = [
  "aws-0-eu-west-3",
  "aws-1-eu-central-1",
  "aws-0-eu-central-1",
  "aws-0-eu-west-1",
  "aws-0-eu-west-2",
  "aws-0-us-east-1",
  "aws-0-us-west-1",
  "aws-0-ap-southeast-1",
  "aws-0-ap-northeast-1",
];

function refFromSupabaseUrl(url: string | undefined) {
  const m = String(url || "").match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? "";
}

function regionFromDatabaseUrl(url: string | undefined) {
  const hostMatch = String(url || "").match(/@(aws-[01]-[a-z]+-[a-z]+-\d+)\.pooler\.supabase\.com/);
  return hostMatch?.[1] ?? "";
}

function buildPoolerUrl(ref: string, password: string, region: string, port: string) {
  const encoded = encodeURIComponent(password);
  if (port === "6543") {
    return `postgresql://postgres.${ref}:${encoded}@${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require&connection_limit=1&pool_timeout=30`;
  }
  return `postgresql://postgres.${ref}:${encoded}@${region}.pooler.supabase.com:${port}/postgres?sslmode=require`;
}

/** Prisma runtime URL — transaction pooler (6543) must use pgbouncer=true (no prepared statements). */
export function resolvePrismaRuntimeDatabaseUrl(raw = process.env.DATABASE_URL ?? ""): string {
  const url = raw.trim();
  if (!url) return url;
  const u = new URL(url.replace(/^postgres(ql)?:\/\//i, "http://"));
  const isTransactionPooler = u.port === "6543" || (u.hostname.includes("pooler.supabase.com") && u.port !== "5432");
  if (!isTransactionPooler) {
    return url;
  }
  u.searchParams.set("pgbouncer", "true");
  if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
  if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
  if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "30");
  return u.toString().replace(/^http:\/\//, "postgresql://");
}

function normalizeExistingUrl(raw: string, port: string) {
  let url = raw;
  url = url.replace(/:\d+\//, `:${port}/`).replace(/:\d+(?=\/)/, `:${port}`);
  url = url.replace(/\?&/, "?").replace(/\?$/, "");
  const u = new URL(url.replace(/^postgres(ql)?:\/\//i, "http://"));
  if (port === "6543") {
    u.port = "6543";
    u.searchParams.set("pgbouncer", "true");
    u.searchParams.set("sslmode", "require");
    u.searchParams.set("connection_limit", "1");
    u.searchParams.set("pool_timeout", "30");
  } else if (!u.searchParams.has("sslmode")) {
    u.searchParams.set("sslmode", "require");
  }
  return u.toString().replace(/^http:\/\//, "postgresql://");
}

export type DatabaseUrlMode = "session" | "transaction";

export function resolveDatabaseUrl(mode: DatabaseUrlMode = "transaction") {
  const port = mode === "session" ? "5432" : "6543";
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  const ref = refFromSupabaseUrl(process.env.SUPABASE_URL);
  const hintedRegion = regionFromDatabaseUrl(process.env.DATABASE_URL);

  if (password && ref) {
    const region = hintedRegion || POOLER_REGIONS[0];
    return buildPoolerUrl(ref, password, region, port);
  }

  if (process.env.DATABASE_URL) {
    return normalizeExistingUrl(process.env.DATABASE_URL, port);
  }

  throw new Error("No database credentials: set SUPABASE_DB_PASSWORD + SUPABASE_URL or DATABASE_URL");
}

export function resolveDatabaseUrlCandidates(mode: DatabaseUrlMode = "session") {
  const port = mode === "session" ? "5432" : "6543";
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  const ref = refFromSupabaseUrl(process.env.SUPABASE_URL);
  const candidates: string[] = [];

  if (password && ref) {
    for (const region of POOLER_REGIONS) {
      candidates.push(buildPoolerUrl(ref, password, region, port));
    }
  }
  if (process.env.DATABASE_URL) {
    candidates.push(normalizeExistingUrl(process.env.DATABASE_URL, port));
  }
  return [...new Set(candidates)];
}

export function applyResolvedDatabaseUrl(mode: DatabaseUrlMode = "transaction") {
  // Never override an explicit Vercel/runtime DATABASE_URL — only fill when missing.
  if (process.env.DATABASE_URL?.trim()) return;
  if (process.env.SUPABASE_DB_PASSWORD && process.env.SUPABASE_URL) {
    process.env.DATABASE_URL = resolveDatabaseUrl(mode);
  }
}

/** Direct/session URL for Prisma migrate, db execute, and seed — never for app runtime. */
export function resolveDirectDatabaseUrl(): string {
  if (process.env.DIRECT_URL?.trim()) return process.env.DIRECT_URL.trim();
  return resolveDatabaseUrl("session");
}
