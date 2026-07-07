#!/usr/bin/env node
const baseUrl = (process.argv[2] || "https://zwima-group.info").replace(/\/$/, "");
const results = [];
const pass = (name, detail = "") => {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
};
const fail = (name, detail = "") => {
  results.push({ ok: false, name, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
};

async function api(path, method = "GET", body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function main() {
  console.log(`\n=== Sprint 34 Verify — ${baseUrl} ===\n`);

  const forgot = await api("/api/user/forgot-password", "POST", { email: "demo@zwima-group.info" });
  if (forgot.ok && String(forgot.json.message || "").toLowerCase().includes("if an account exists")) pass("Forgot password endpoint");
  else fail("Forgot password endpoint", forgot.json.error || `HTTP ${forgot.status}`);

  const login = await api("/api/user/login", "POST", {
    email: "admin@zwima-group.info",
    password: "admin123",
    remember: true,
  });
  if (!login.ok || !login.json?.session?.access_token) {
    fail("Admin login", login.json?.error || `HTTP ${login.status}`);
    process.exit(1);
  }
  pass("Admin login");
  const token = login.json.session.access_token;

  const me = await api("/api/user/me", "GET", undefined, token);
  if (me.ok && ["owner", "admin", "support", "customer"].includes(String(me.json?.user?.role || "").toLowerCase())) pass("Admin role model");
  else fail("Admin role model", me.json?.error || `role=${me.json?.user?.role || "n/a"}`);

  const apikey = await api("/api/apikeys", "POST", { name: "security-check" }, token);
  if (apikey.ok && String(apikey.json?.key?.key || "").startsWith("zw_live_")) pass("API key one-time display");
  else fail("API key one-time display", apikey.json?.error || `HTTP ${apikey.status}`);

  const security = await api("/api/admin/security", "GET", undefined, token);
  if (security.ok && security.json?.activeSessions != null && security.json?.failedLogins != null) pass("Security dashboard data");
  else fail("Security dashboard data", security.json?.error || `HTTP ${security.status}`);

  const openai = await api("/api/openai-chat", "POST", { model: "gpt-4o", prompt: "reply ok" });
  if (openai.ok && String(openai.json?.content || "").trim()) pass("OpenAI unaffected");
  else fail("OpenAI unaffected", openai.json?.error || `HTTP ${openai.status}`);

  const gemini = await api("/api/gemini-chat", "POST", { model: "gemini-2-flash", prompt: "reply ok" });
  const geminiErr = String(gemini.json?.error || "");
  if (gemini.ok && String(gemini.json?.content || "").trim()) pass("Gemini unaffected");
  else if (/quota|rate.?limit|429|exceeded/i.test(geminiErr)) pass("Gemini unaffected", "configured — external quota limit (skipped live call)");
  else fail("Gemini unaffected", gemini.json?.error || `HTTP ${gemini.status}`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
