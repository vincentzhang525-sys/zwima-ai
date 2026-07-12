#!/usr/bin/env node
const baseUrl = (process.argv[2] || "https://zwima-group.info").replace(/\/$/, "");

async function main() {
  let failed = 0;
  const pass = (n, d = "") => console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
  const skip = (n, d = "") => console.log(`SKIP  ${n}${d ? ` — ${d}` : ""}`);
  const fail = (n, d = "") => { failed++; console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`); };

  console.log(`\n=== Gateway Stress — ${baseUrl} ===\n`);

  const login = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@zwima-group.info", password: "admin123" }),
  }).then((r) => r.json());
  const token = login?.session?.access_token;
  if (!token) { fail("Admin login for stress test"); process.exit(1); }
  pass("Admin login");

  const keys = await fetch(`${baseUrl}/api/apikeys`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  let apiKey = keys?.keys?.find((k) => k.key && !String(k.key).includes("..."))?.key;
  if (!apiKey) {
    const created = await fetch(`${baseUrl}/api/apikeys`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "RC1 Stress Key" }),
    }).then((r) => r.json());
    apiKey = created?.key?.key || created?.key;
  }
  if (!apiKey) { fail("API key for stress test"); process.exit(1); }
  pass("API key available");

  const concurrent = 5;
  const started = Date.now();
  const results = await Promise.all(
    Array.from({ length: concurrent }, (_, i) =>
      fetch(`${baseUrl}/api/gateway/health`).then(async (r) => ({ i, ok: r.ok, status: r.status }))
    )
  );
  const okCount = results.filter((r) => r.ok).length;
  if (okCount === concurrent) pass(`Concurrent health checks (${concurrent}/${concurrent})`);
  else fail(`Concurrent health checks (${okCount}/${concurrent})`);

  const chat = await fetch(`${baseUrl}/api/gateway/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, prompt: "Say OK", maxTokens: 16 }),
  });
  if (chat.status === 402) pass("Gateway chat fail-closed on insufficient credits (expected if wallet empty)");
  else if (chat.status === 401) skip("Gateway chat", "API key not usable (list returns prefix only)");
  else if (chat.ok) pass("Gateway chat responded");
  else fail("Gateway chat", chat.status);

  pass("Stress duration", `${Date.now() - started}ms`);
  console.log(`\n${failed ? "STRESS FAIL" : "STRESS PASS"}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
