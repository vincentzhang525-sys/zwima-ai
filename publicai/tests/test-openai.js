#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8793;
const ROOT = __dirname.replace(/[/\\]tests$/, "");
const MOCK_DIR = path.join(ROOT, "mock");

const { loadDotEnv, applyToProcess, loadIntoGlobalConfig } = require(path.join(ROOT, "utils/envLoader"));
global.ZWIMA_CONFIG = { GATEWAY_MODE: "mock", MOCK_ERROR_RATE: 0, JWT_ACCESS_TTL_SEC: 900, JWT_REFRESH_TTL_SEC: 604800 };
applyToProcess(loadDotEnv(path.join(ROOT, ".env"), fs));
loadIntoGlobalConfig(loadDotEnv(path.join(ROOT, ".env"), fs), global.ZWIMA_CONFIG);

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

async function boot() {
  require(path.join(ROOT, "auth/permissionManager"));
  require(path.join(ROOT, "auth/jwtManager"));
  require(path.join(ROOT, "gateway/gatewayConfig"));
  require(path.join(ROOT, "gateway/secrets"));
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

  const dbReady = ZwimaDatabase.init({ driver: "mock", errorRate: 0, fs, path, mockDir: MOCK_DIR });
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
  return { server, ZwimaDatabase };
}

async function main() {
  const { server } = await boot();
  const login = await req("/api/auth/signin", "POST", {
    email: "admin@zwima-group.info",
    password: "password123",
  });
  const auth = `Bearer ${login.json?.data?.tokens?.accessToken}`;
  const results = [];

  async function run(name, fn) {
    const out = await fn();
    results.push({ name, status: out.status, ok: out.status === 200, data: out.json?.data });
  }

  await run("OpenAI Mock Mode Chat", () =>
    req("/api/gateway/chat", "POST", { providerId: "openai", mode: "mock", prompt: "Hello", model: "gpt-4o" }, auth)
  );

  await run("OpenAI Real Mode Fallback (no key)", () =>
    req("/api/gateway/chat", "POST", { providerId: "openai", mode: "real", prompt: "Hello", model: "gpt-4o" }, auth)
  );

  await run("OpenAI Health (mock)", () => req("/api/gateway/health", "GET", null, auth));

  await run("Playground Mock Mode", () =>
    req("/api/playground/run", "POST", { providerId: "openai", mode: "mock", prompt: "test", model: "gpt-4o" }, auth)
  );

  await run("Playground Real Mode Fallback", () =>
    req("/api/playground/run", "POST", { providerId: "openai", mode: "real", prompt: "test", model: "gpt-4o" }, auth)
  );

  const hasKey = !!process.env.OPENAI_API_KEY;
  if (hasKey) {
    await run("OpenAI Real Mode Live", () =>
      req("/api/gateway/chat", "POST", { providerId: "openai", mode: "real", prompt: "Say hi in 3 words", model: "gpt-4o", maxTokens: 20 }, auth)
    );
    await run("OpenAI Health Live", () => req("/api/gateway/health", "GET", null, auth));
  } else {
    results.push({ name: "OpenAI Real Mode Live (skipped — no OPENAI_API_KEY)", status: 200, ok: true, data: { skipped: true } });
    results.push({ name: "OpenAI Health Live (skipped — no OPENAI_API_KEY)", status: 200, ok: true, data: { skipped: true } });
  }

  server.close();

  const passed = results.filter((r) => r.ok).length;
  console.log("\n=== Sprint 12 OpenAI Tests ===\n");
  results.forEach((r) => {
    console.log(`${r.ok ? "PASS" : "FAIL"}  HTTP ${r.status}  ${r.name}`);
    if (r.data?.usage) {
      console.log(
        `       provider=${r.data.provider} model=${r.data.model} latency=${r.data.latency}ms tokens=${r.data.usage.totalTokens} fallback=${!!r.data.fallback}`
      );
    }
  });
  console.log(`\n${passed}/${results.length} passed`);
  console.log(hasKey ? "OPENAI_API_KEY detected — live tests included.\n" : "No OPENAI_API_KEY — live tests skipped.\n");
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
