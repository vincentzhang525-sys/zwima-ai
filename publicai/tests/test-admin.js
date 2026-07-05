#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8795;
const ROOT = __dirname.replace(/[/\\]tests$/, "");
const MOCK_DIR = path.join(ROOT, "mock");

global.ZWIMA_CONFIG = { MOCK_ERROR_RATE: 0, JWT_ACCESS_TTL_SEC: 900, JWT_REFRESH_TTL_SEC: 604800, STRIPE_MODE: "mock" };

function req(pathname, method, body, auth) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      { hostname: "127.0.0.1", port: PORT, path: pathname, method, headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}), ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) } },
      (res) => {
        let raw = "";
        res.on("data", (c) => { raw += c; });
        res.on("end", () => { try { resolve({ status: res.statusCode, json: JSON.parse(raw || "{}") }); } catch (e) { reject(e); } });
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (c) => { data += c; });
    request.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    request.on("error", reject);
  });
}

async function boot() {
  require(path.join(ROOT, "auth/permissionManager"));
  require(path.join(ROOT, "auth/jwtManager"));
  require(path.join(ROOT, "auth/authEngine"));
  require(path.join(ROOT, "admin/adminEngine"));
  require(path.join(ROOT, "gateway/gatewayConfig"));
  require(path.join(ROOT, "gateway/adapters/BaseProviderAdapter"));
  require(path.join(ROOT, "gateway/adapters/OpenAIAdapter"));
  require(path.join(ROOT, "gateway/adapters/AnthropicAdapter"));
  require(path.join(ROOT, "gateway/adapters/GoogleGeminiAdapter"));
  require(path.join(ROOT, "gateway/adapters/DeepSeekAdapter"));
  require(path.join(ROOT, "gateway/adapters/QwenAdapter"));
  require(path.join(ROOT, "gateway/adapters/MistralAdapter"));
  require(path.join(ROOT, "gateway/adapters/OpenRouterAdapter"));
  require(path.join(ROOT, "gateway/adapters/OpenAICompatibleAdapter"));
  require(path.join(ROOT, "gateway/adapters/index"));
  require(path.join(ROOT, "gateway/providerManager"));
  require(path.join(ROOT, "gateway/routingEngine"));
  require(path.join(ROOT, "gateway/healthMonitor"));
  require(path.join(ROOT, "gateway/gateway"));
  require(path.join(ROOT, "stripe/stripeConfig"));
  require(path.join(ROOT, "stripe/stripeService"));
  require(path.join(ROOT, "stripe/webhookService"));
  require(path.join(ROOT, "database/seed"));
  require(path.join(ROOT, "database/adapters/MockAdapter"));
  require(path.join(ROOT, "database/adapters/SQLiteAdapter"));
  require(path.join(ROOT, "database/adapters/PostgresAdapter"));
  require(path.join(ROOT, "database/DatabaseAdapter"));
  require(path.join(ROOT, "database/health"));
  require(path.join(ROOT, "database/repositories/BaseRepository"));
  require(path.join(ROOT, "database/repositories/ProviderRepository"));
  require(path.join(ROOT, "database/repositories/ModelRepository"));
  require(path.join(ROOT, "database/repositories/ApiKeyRepository"));
  require(path.join(ROOT, "database/repositories/CreditRepository"));
  require(path.join(ROOT, "database/repositories/BillingRepository"));
  require(path.join(ROOT, "database/repositories/UserRepository"));
  require(path.join(ROOT, "database/repositories/AuthRepository"));
  require(path.join(ROOT, "database/repositories/RoutingRepository"));
  require(path.join(ROOT, "database/repositories/LogRepository"));
  require(path.join(ROOT, "database/repositories/SettingsRepository"));
  require(path.join(ROOT, "database/repositories/GatewayRepository"));
  require(path.join(ROOT, "database/repositories/PaymentRepository"));
  require(path.join(ROOT, "database/repositories/InvoiceRepository"));
  require(path.join(ROOT, "database/repositories/TransactionRepository"));
  require(path.join(ROOT, "database/repositories/AdminUserRepository"));
  require(path.join(ROOT, "database/repositories/AuditLogRepository"));
  require(path.join(ROOT, "database/repositories/PricingRepository"));
  require(path.join(ROOT, "database/repositories/AdminStatsRepository"));
  require(path.join(ROOT, "database/repositories/AdminRepository"));
  const ZwimaDatabase = require(path.join(ROOT, "database/index"));

  const dbReady = ZwimaDatabase.init({ driver: "mock", errorRate: 0, fs, path, mockDir: MOCK_DIR });
  const server = http.createServer(async (request, res) => {
    const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
    await dbReady;
    const body = request.method === "POST" ? await readBody(request) : undefined;
    try {
      const result = await ZwimaDatabase.queryApi(url.pathname, request.method, body, { authorization: request.headers.authorization, query: url.search });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: result.data }));
    } catch (e) {
      res.writeHead(e.code || 500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: { message: e.message } }));
    }
  });
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  return { server };
}

async function main() {
  const { server } = await boot();
  const login = await req("/api/auth/signin", "POST", { email: "admin@zwima-group.info", password: "password123" });
  const auth = `Bearer ${login.json?.data?.tokens?.accessToken}`;
  const results = [];

  async function run(name, fn) {
    const out = await fn();
    results.push({ name, status: out.status, ok: out.status === 200 });
  }

  await run("List Users", () => req("/api/admin/users", "GET", null, auth));
  await run("Search Users", () => req("/api/admin/users?q=alex", "GET", null, auth));
  await run("Toggle User", () => req("/api/admin/users/toggle", "POST", { userId: "user-viewer-1", enabled: true }, auth));
  await run("Adjust Credits", () => req("/api/admin/users/credits", "POST", { userId: "user-demo-1", delta: 100 }, auth));
  await run("List Providers", () => req("/api/admin/providers", "GET", null, auth));
  await run("Update Provider", () => req("/api/admin/providers/update", "POST", { providerId: "qwen", enabled: true, priority: 5 }, auth));
  await run("List Pricing", () => req("/api/admin/pricing", "GET", null, auth));
  await run("Update Pricing", () => req("/api/admin/pricing/update", "POST", { id: "price-1", sellPrice: 0.0000045 }, auth));
  await run("Billing Manager", () => req("/api/admin/billing", "GET", null, auth));
  await run("List API Keys", () => req("/api/admin/apikeys", "GET", null, auth));
  const key = await req("/api/admin/apikeys/create", "POST", { name: "Admin Test Key" }, auth);
  const keyId = key.json?.data?.id;
  if (keyId) {
    await run("Toggle API Key", () => req("/api/admin/apikeys/toggle", "POST", { keyId, enabled: false }, auth));
    await run("Set Quota", () => req("/api/admin/apikeys/quota", "POST", { keyId, quota: "25,000 / mo" }, auth));
    await run("Delete API Key", () => req("/api/admin/apikeys/delete", "POST", { keyId }, auth));
  }
  await run("Statistics", () => req("/api/admin/statistics", "GET", null, auth));
  await run("Audit Log", () => req("/api/admin/audit", "GET", null, auth));

  const forbidden = await req("/api/admin/users", "GET", null, null);
  results.push({ name: "Non-auth blocked", status: forbidden.status, ok: forbidden.status === 401 });

  server.close();
  const passed = results.filter((r) => r.ok).length;
  console.log("\n=== Sprint 14 Admin Tests ===\n");
  results.forEach((r) => console.log(`${r.ok ? "PASS" : "FAIL"}  HTTP ${r.status}  ${r.name}`));
  console.log(`\n${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
