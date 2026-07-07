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
  console.log(`\n=== Sprint 33 Verify — ${baseUrl} ===\n`);

  const login = await api("/api/user/login", "POST", {
    email: "demo@zwima-group.info",
    password: "demo123",
  });
  if (!login.ok || !login.json?.session?.access_token) {
    fail("Login demo user", login.json?.error || `HTTP ${login.status}`);
    process.exit(1);
  }
  pass("Login demo user");
  const token = login.json.session.access_token;

  const pricing = await api("/pricing.html");
  if (pricing.ok && pricing.text.includes("FREE") && pricing.text.includes("BUSINESS")) pass("Pricing page plans");
  else fail("Pricing page plans", `HTTP ${pricing.status}`);

  const billingPage = await api("/billing.html");
  if (billingPage.ok && billingPage.text.includes("Upgrade Plan")) pass("Billing page exists");
  else fail("Billing page exists", `HTTP ${billingPage.status}`);

  const beforeWallet = await api("/api/credits", "GET", undefined, token);
  const before = Number(beforeWallet.json?.wallet?.balance) || 0;
  const upgrade = await api("/api/billing", "POST", { action: "upgrade", plan: "starter", provider: "stripe" }, token);
  if (upgrade.ok && Number(upgrade.json?.creditsAdded) > 0) pass("Billing upgrade + payment provisioning");
  else fail("Billing upgrade + payment provisioning", upgrade.json?.error || `HTTP ${upgrade.status}`);

  const afterWallet = await api("/api/credits", "GET", undefined, token);
  const after = Number(afterWallet.json?.wallet?.balance) || 0;
  if (after > before) pass("Credits auto increased", `${before} -> ${after}`);
  else fail("Credits auto increased", `${before} -> ${after}`);

  const billingData = await api("/api/billing", "GET", undefined, token);
  if (billingData.ok && billingData.json?.billing?.payments?.length >= 1) pass("Billing API history");
  else fail("Billing API history", billingData.json?.error || "no payments");

  const openai = await api("/api/openai-chat", "POST", { model: "gpt-4o", prompt: "Reply with OK" });
  if (openai.ok && String(openai.json?.content || "").trim()) pass("OpenAI unaffected");
  else fail("OpenAI unaffected", openai.json?.error || `HTTP ${openai.status}`);

  const gemini = await api("/api/gemini-chat", "POST", { model: "gemini-2-flash", prompt: "Reply with OK" });
  if (gemini.ok && String(gemini.json?.content || "").trim()) pass("Gemini unaffected");
  else fail("Gemini unaffected", gemini.json?.error || `HTTP ${gemini.status}`);

  const admin = await api("/admin.js");
  if (admin.ok && admin.text.includes("Monthly Revenue") && admin.text.includes("MRR") && admin.text.includes("ARR")) {
    pass("Admin commercial metrics UI");
  } else fail("Admin commercial metrics UI", `HTTP ${admin.status}`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
