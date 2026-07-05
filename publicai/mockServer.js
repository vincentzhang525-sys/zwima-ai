#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.argv[2]) || 8787;
const ROOT = __dirname;
const MOCK_DIR = path.join(ROOT, "mock");

const { loadDotEnv, applyToProcess, loadIntoGlobalConfig } = require("./utils/envLoader");
global.ZWIMA_CONFIG = {
  JWT_ACCESS_TTL_SEC: 900,
  JWT_REFRESH_TTL_SEC: 604800,
  MOCK_ERROR_RATE: 0,
  GATEWAY_MODE: "mock",
  GATEWAY_HEALTH_INTERVAL_MS: 30000,
  PLAYGROUND_MODE: "mock",
  STRIPE_MODE: "mock",
};
applyToProcess(loadDotEnv(path.join(ROOT, ".env"), fs));
loadIntoGlobalConfig(loadDotEnv(path.join(ROOT, ".env"), fs), global.ZWIMA_CONFIG);

require("./auth/permissionManager");
require("./auth/jwtManager");
require("./gateway/gatewayConfig");
require("./gateway/secrets");
require("./gateway/adapters/BaseProviderAdapter");
require("./gateway/adapters/OpenAIAdapter");
require("./gateway/adapters/AnthropicAdapter");
require("./gateway/adapters/GoogleGeminiAdapter");
require("./gateway/adapters/DeepSeekAdapter");
require("./gateway/adapters/QwenAdapter");
require("./gateway/adapters/MistralAdapter");
require("./gateway/adapters/OpenRouterAdapter");
require("./gateway/adapters/OpenAICompatibleAdapter");
require("./gateway/adapters/index");
require("./gateway/providerManager");
require("./gateway/routingEngine");
require("./gateway/healthMonitor");
require("./gateway/gateway");
require("./auth/authEngine");
require("./database/seed");
require("./database/adapters/MockAdapter");
require("./database/adapters/SQLiteAdapter");
require("./database/adapters/PostgresAdapter");
require("./database/DatabaseAdapter");
require("./database/health");
require("./database/repositories/BaseRepository");
require("./database/repositories/ProviderRepository");
require("./database/repositories/ModelRepository");
require("./database/repositories/ApiKeyRepository");
require("./database/repositories/CreditRepository");
require("./database/repositories/BillingRepository");
require("./database/repositories/UserRepository");
require("./database/repositories/AuthRepository");
require("./database/repositories/RoutingRepository");
require("./database/repositories/LogRepository");
require("./database/repositories/SettingsRepository");
require("./database/repositories/GatewayRepository");
require("./database/repositories/PaymentRepository");
require("./database/repositories/InvoiceRepository");
require("./database/repositories/TransactionRepository");
require("./database/repositories/AdminUserRepository");
require("./database/repositories/AuditLogRepository");
require("./database/repositories/PricingRepository");
require("./database/repositories/AdminStatsRepository");
require("./database/repositories/AdminRepository");
require("./admin/adminEngine");
require("./stripe/stripeConfig");
require("./stripe/stripeService");
require("./stripe/webhookService");
const ZwimaDatabase = require("./database/index");

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
const dbReady = ZwimaDatabase.init({ driver: "mock", errorRate: 0, fs, path, mockDir: MOCK_DIR });

function buildPagination(total) {
  return { page: 1, limit: total, total, totalPages: Math.max(1, Math.ceil(total / (total || 1))) };
}

function apiResponse(data, pagination) {
  return { success: true, data, error: null, pagination: pagination || null, timestamp: new Date().toISOString() };
}

function apiError(message, code = 500) {
  return { success: false, data: null, error: { message, code }, pagination: null, timestamp: new Date().toISOString() };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(payload));
}

async function handleApi(req, res, pathname, search) {
  await dbReady;
  const body = req.method === "POST" ? await readBody(req) : undefined;
  try {
    const result = await ZwimaDatabase.queryApi(pathname, req.method, body, {
      authorization: req.headers.authorization,
      query: search,
    });
    const status = req.method === "POST" && pathname === "/api/apikey/create" ? 201 : 200;
    sendJson(res, status, apiResponse(result.data, result.total != null ? buildPagination(result.total) : null));
  } catch (e) {
    sendJson(res, e.code || 401, apiError(e.message, e.code || 401));
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" });
    res.end();
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url.pathname, url.search);
    return;
  }
  let filePath = path.join(ROOT, url.pathname === "/" ? "index.html" : url.pathname);
  if (!path.extname(filePath) && !fs.existsSync(filePath)) filePath += ".html";
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`ZWIMA Mock Server http://localhost:${PORT}`));
