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
  const query = port === "6543" ? "?pgbouncer=true&sslmode=require" : "?sslmode=require";
  return `postgresql://postgres.${ref}:${encoded}@${region}.pooler.supabase.com:${port}/postgres${query}`;
}

function normalizeExistingUrl(raw: string, port: string) {
  let url = raw;
  url = url.replace(/:\d+\//, `:${port}/`).replace(/:\d+(?=\/)/, `:${port}`);
  url = url.replace(/\?pgbouncer=true&?/i, port === "6543" ? "?pgbouncer=true&" : "?");
  url = url.replace(/\?&/, "?").replace(/\?$/, "");
  if (!url.includes("sslmode=")) {
    url += url.includes("?") ? "&sslmode=require" : "?sslmode=require";
  }
  if (port === "6543" && !url.includes("pgbouncer=true")) {
    url += url.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
  }
  return url;
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
  if (process.env.SUPABASE_DB_PASSWORD && process.env.SUPABASE_URL) {
    process.env.DATABASE_URL = resolveDatabaseUrl(mode);
  }
}
