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

function getClientIp(req) {
  const xfwd = req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"] || "";
  const first = String(Array.isArray(xfwd) ? xfwd[0] : xfwd)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)[0];
  return first || req.socket?.remoteAddress || "unknown";
}

async function enforceRateLimit({
  req,
  route,
  limit,
  windowSeconds,
  key,
}) {
  const admin = getAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000).toISOString();
  const lookupKey = String(key || getClientIp(req));

  const { data: rows, error } = await admin
    .from("rate_limits")
    .select("*")
    .eq("key", lookupKey)
    .eq("route", route)
    .gte("window_start", windowStart)
    .order("window_start", { ascending: false })
    .limit(1);
  if (error) throw error;

  const row = rows?.[0];
  if (!row) {
    const { error: insertError } = await admin.from("rate_limits").insert({
      key: lookupKey,
      route,
      count: 1,
      window_start: now.toISOString(),
    });
    if (insertError) throw insertError;
    return { allowed: true, remaining: limit - 1 };
  }

  const current = Number(row.count) || 0;
  if (current >= limit) {
    return { allowed: false, remaining: 0 };
  }

  const { error: updateError } = await admin.from("rate_limits").update({ count: current + 1 }).eq("id", row.id);
  if (updateError) throw updateError;
  return { allowed: true, remaining: Math.max(0, limit - (current + 1)) };
}

async function writeAuditLog({
  userId = null,
  organizationId = null,
  teamId = null,
  eventType,
  action,
  target = "",
  detail = "",
  ip = "",
  notify = false,
  notificationCategory = "system",
}) {
  try {
    const admin = getAdminClient();
    await admin.from("audit_logs").insert({
      user_id: userId,
      organization_id: organizationId || null,
      team_id: teamId || null,
      event_type: eventType,
      action,
      target,
      detail,
      ip,
    });
    if (notify && userId) {
      await admin.from("notifications").insert({
        user_id: userId,
        category: notificationCategory,
        title: action,
        message: detail || target || action,
      });
    }
  } catch (err) {
    console.warn("[audit_log] failed", err.message);
  }
}

async function writeSecurityEvent({
  eventType,
  userId = null,
  ip = "",
  detail = "",
}) {
  try {
    const admin = getAdminClient();
    await admin.from("security_events").insert({
      event_type: eventType,
      user_id: userId,
      ip,
      detail,
    });
  } catch (err) {
    console.warn("[security_event] failed", err.message);
  }
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
  getClientIp,
  enforceRateLimit,
  writeAuditLog,
  writeSecurityEvent,
  json,
  handleOptions,
  withCors,
};
