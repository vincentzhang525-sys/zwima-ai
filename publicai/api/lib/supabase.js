const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getSupabaseUrl() {
  return requireEnv("SUPABASE_URL");
}

function getSupabaseAnonKey() {
  return requireEnv("SUPABASE_ANON_KEY");
}

function getAdminClient() {
  return createClient(getSupabaseUrl(), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getAnonClient(accessToken) {
  const client = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
  });
  return client;
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

async function getAuthedClient(req) {
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error("Missing authorization token");
    err.status = 401;
    throw err;
  }

  const client = getAnonClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error("Invalid or expired session");
    err.status = 401;
    throw err;
  }

  return { client, user: data.user, token };
}

function mapProfile(row, wallet) {
  if (!row) return null;
  const balance = Number(wallet?.balance) || 0;
  return {
    id: row.id,
    email: row.email,
    name: row.company || row.email?.split("@")[0],
    company: row.company,
    country: row.country,
    role: row.role,
    status: row.status,
    plan: row.plan,
    language: row.language,
    timezone: row.timezone,
    credits: balance,
    creditsBalance: String(balance),
    emailVerified: true,
    contactName: row.company || row.email?.split("@")[0],
    apiKeyCount: 0,
    createdAt: row.created_at,
  };
}

async function loadProfile(client, userId) {
  const [{ data: profile, error: profileError }, { data: wallet, error: walletError }] =
    await Promise.all([
      client.from("profiles").select("*").eq("id", userId).maybeSingle(),
      client.from("credit_wallets").select("*").eq("user_id", userId).maybeSingle(),
    ]);

  if (profileError) throw profileError;
  if (walletError) throw walletError;
  return mapProfile(profile, wallet);
}

function hashApiKey(secret) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

function json(res, status, payload) {
  res.status(status).json(payload);
}

function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).end();
    return true;
  }
  return false;
}

function withCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
}

module.exports = {
  getAdminClient,
  getAnonClient,
  parseBody,
  getBearerToken,
  getAuthedClient,
  mapProfile,
  loadProfile,
  hashApiKey,
  json,
  handleOptions,
  withCors,
};
