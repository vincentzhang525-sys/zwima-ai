#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8792;
const ROOT = __dirname.replace(/[/\\]tests$/, "");
const MOCK_DIR = path.join(ROOT, "mock");

global.ZWIMA_CONFIG = {
  GATEWAY_MODE: "mock",
  GATEWAY_HEALTH_INTERVAL_MS: 30000,
  MOCK_ERROR_RATE: 0,
  JWT_ACCESS_TTL_SEC: 900,
  JWT_REFRESH_TTL_SEC: 604800,
};

function req(pathname, method, body, auth) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path: pathname,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(auth ? { Authorization: auth } : {}),
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => { raw += c; });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(raw || "{}") });
          } catch (e) {
            reject(e);
          }
        });
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

async function main() {
  require(path.join(ROOT, "auth/permissionManager"));
  require(path.join(ROOT, "auth/jwtManager"));
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
  require(path.join(ROOT, "auth/authEngine"));
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
  const ZwimaDatabase = require(path.join(ROOT, "database/index"));

  const dbReady = ZwimaDatabase.init({ driver: "mock", errorRate: 0, fs, path: path, mockDir: MOCK_DIR });
  const server = http.createServer(async (request, res) => {
    const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
    await dbReady;
    const body = request.method === "POST" ? await readBody(request) : undefined;
    try {
      const result = await ZwimaDatabase.queryApi(url.pathname, request.method, body, {
        authorization: request.headers.authorization,
        query: url.search,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: result.data }));
    } catch (e) {
      res.writeHead(e.code || 500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: { message: e.message } }));
    }
  });

  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

  const login = await req("/api/auth/signin", "POST", {
    email: "admin@zwima-group.info",
    password: "password123",
  });
  const token = login.json?.data?.tokens?.accessToken;
  const auth = `Bearer ${token}`;
  const results = [];

  async function run(name, fn) {
    const out = await fn();
    results.push({ name, status: out.status, ok: out.status === 200 });
  }

  await run("Gateway Health", () => req("/api/gateway/health", "GET", null, auth));
  await run("List Models", () => req("/api/gateway/models", "GET", null, auth));
  await run("Gateway Chat", () =>
    req(
      "/api/gateway/chat",
      "POST",
      { providerId: "openai", prompt: "Hello gateway", model: "gpt-5" },
      auth
    )
  );
  await run("Gateway Embeddings", () =>
    req("/api/gateway/embeddings", "POST", { providerId: "openai", input: "embed this" }, auth)
  );
  await run("Gateway Image", () =>
    req("/api/gateway/image", "POST", { providerId: "openai", prompt: "a blue logo" }, auth)
  );
  await run("Gateway Audio", () =>
    req("/api/gateway/audio", "POST", { providerId: "openai", input: "hello world" }, auth)
  );
  await run("Gateway Route", () =>
    req("/api/gateway/route", "POST", { prompt: "write python code", strategy: "Lowest Cost" }, auth)
  );
  await run("Playground via Gateway", () =>
    req("/api/playground/run", "POST", { providerId: "anthropic", prompt: "test", model: "Claude 4 Sonnet" }, auth)
  );
  await run("Routing Simulate", () =>
    req("/api/routing/simulate", "POST", { prompt: "translate to german", strategy: "Fastest Response" }, auth)
  );
  await run("Provider Manager List", () => req("/api/gateway/providers", "GET", null, auth));

  server.close();

  const passed = results.filter((r) => r.ok).length;
  console.log("\n=== Sprint 11 Gateway Tests ===\n");
  results.forEach((r) => console.log(`${r.ok ? "PASS" : "FAIL"}  HTTP ${r.status}  ${r.name}`));
  console.log(`\n${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
