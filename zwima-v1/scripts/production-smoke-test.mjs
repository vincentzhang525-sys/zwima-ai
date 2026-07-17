#!/usr/bin/env node
/**
 * Production smoke test via deployed zwima-v1 endpoints (no local secrets).
 */
const BASE = process.env.SMOKE_BASE_URL || "https://zwima-group.info";

const PROVIDERS = ["openai", "gemini", "deepseek", "qwen", "claude"];

function providerOnline(health, slug) {
  if (health?.[slug] === "ok") return true;
  const list = Array.isArray(health?.providers) ? health.providers : [];
  const entry = list.find((p) => p?.provider === slug || p?.slug === slug);
  if (!entry) return false;
  if (entry.online === true) return true;
  if (entry.status === "ok") return true;
  return false;
}

async function main() {
  console.log("=== zwima-v1 Production Smoke Test ===");
  console.log("Base URL:", BASE, "\n");

  const results = { endpoints: {}, providers: {}, chat: null, pass: false };

  for (const [name, path, init] of [
    ["health", "/api/v1/health", {}],
    ["models", "/api/v1/models", {}],
    ["dashboard", "/dashboard", { redirect: "manual" }],
  ]) {
    const res = await fetch(BASE + path, init);
    const location = res.headers.get("location") || "";
    results.endpoints[name] = { status: res.status, ok: res.status < 500, location };
    console.log(
      `${path}: HTTP ${res.status}${name === "dashboard" && location ? " → " + location : ""}`
    );
  }

  const health = await fetch(BASE + "/api/v1/health").then((r) => r.json());
  console.log("\n--- Provider health (/api/v1/health) ---");
  for (const slug of PROVIDERS) {
    const ok = providerOnline(health, slug);
    const status = ok ? "ok" : "offline";
    results.providers[slug] = { status, pass: ok };
    console.log(`${slug}: ${status} ${ok ? "PASS" : "FAIL"}`);
  }

  const chatRes = await fetch(BASE + "/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: "ping" }],
    }),
  });
  const chatBody = await chatRes.text();
  results.chat = {
    status: chatRes.status,
    accessible: chatRes.status === 401 || chatRes.status === 200,
    body: chatBody.slice(0, 120),
  };
  console.log(`\n/api/v1/chat (no key): HTTP ${chatRes.status} — ${results.chat.accessible ? "accessible" : "FAIL"}`);

  const dashStatus = results.endpoints.dashboard?.status;
  const dashOk = dashStatus === 307 || dashStatus === 302 || dashStatus === 303;
  const providerPass = PROVIDERS.every((p) => results.providers[p]?.pass);
  const endpointPass =
    results.endpoints.health?.ok &&
    results.endpoints.models?.ok &&
    dashOk &&
    results.chat.accessible;

  results.pass = providerPass && endpointPass;

  console.log("\n=== Summary ===");
  console.log("Endpoints:", endpointPass ? "PASS" : "FAIL");
  console.log("Providers (5/5):", providerPass ? "PASS" : "FAIL");
  console.log("Overall:", results.pass ? "PASS" : "NOT PASS");

  const out = new URL("../docs/PHASE6_PRODUCTION_SMOKE.json", import.meta.url);
  const fs = await import("node:fs");
  fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, ...results }, null, 2));
  console.log("\nWrote", out.pathname || out.href);

  process.exit(results.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
