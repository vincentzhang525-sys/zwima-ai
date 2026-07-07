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
  console.log(`\n=== Sprint 32 Verify — ${baseUrl} ===\n`);
  const email = `beta.${Date.now()}@zwima-group.info`;
  const register = await api("/api/user/register", "POST", {
    company: "ZWIMA Beta",
    email,
    password: "beta1234",
    country: "Germany",
  });
  if (register.ok) pass("User onboarding registration");
  else fail("User onboarding registration", register.json?.error || `HTTP ${register.status}`);

  const login = await api("/api/user/login", "POST", {
    email: "demo@zwima-group.info",
    password: "demo123",
  });
  if (!login.ok || !login.json?.session?.access_token) {
    fail("Login flow", login.json?.error || `HTTP ${login.status}`);
    process.exit(1);
  }
  pass("Login flow with redirect-ready session");
  const token = login.json.session.access_token;

  const openai = await api("/api/openai-chat", "POST", { model: "gpt-4o", prompt: "Reply with OK" });
  if (openai.ok && String(openai.json?.content || "").trim()) pass("OpenAI Playground");
  else fail("OpenAI Playground", openai.json?.error || `HTTP ${openai.status}`);

  const gemini = await api("/api/gemini-chat", "POST", { model: "gemini-2-flash", prompt: "Reply with OK" });
  if (gemini.ok && String(gemini.json?.content || "").trim()) pass("Gemini Playground");
  else fail("Gemini Playground", gemini.json?.error || `HTTP ${gemini.status}`);

  const key = await api("/api/apikeys", "POST", { name: `beta-key-${Date.now()}` }, token);
  if (key.ok && key.json?.key?.key) pass("API key create");
  else fail("API key create", key.json?.error || `HTTP ${key.status}`);

  const gateway = await api(
    "/api/gateway/chat",
    "POST",
    { apiKey: key.json?.key?.key, prompt: "Explain API gateway in one sentence.", routingMode: "intelligent" },
    undefined
  );
  if (gateway.ok && gateway.json?.content) pass("API gateway chat");
  else fail("API gateway chat", gateway.json?.error || `HTTP ${gateway.status}`);

  const usage = await api("/api/usage", "GET", undefined, token);
  if (usage.ok && Array.isArray(usage.json?.records)) pass("Usage records API");
  else fail("Usage records API", usage.json?.error || `HTTP ${usage.status}`);

  const credits = await api("/api/credits", "GET", undefined, token);
  if (credits.ok && credits.json?.wallet) pass("Credits wallet API");
  else fail("Credits wallet API", credits.json?.error || `HTTP ${credits.status}`);

  const docs = await api("/documentation.html");
  if (docs.ok && docs.text.includes("/api/gateway/chat") && docs.text.includes("Authentication")) pass("API documentation page");
  else fail("API documentation page", `HTTP ${docs.status}`);

  const adminPage = await api("/admin.html");
  if (adminPage.ok && adminPage.text.includes("Admin Overview") && adminPage.text.includes("adminUsersCount")) {
    pass("Admin improvements UI");
  } else fail("Admin improvements UI", `HTTP ${adminPage.status}`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
