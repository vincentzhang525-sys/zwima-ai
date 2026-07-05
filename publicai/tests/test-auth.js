#!/usr/bin/env node
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = 8791;
const ROOT = __dirname.replace(/[/\\]tests$/, "");
const MOCK_DIR = path.join(ROOT, "mock");

global.ZWIMA_CONFIG = { JWT_ACCESS_TTL_SEC: 900, JWT_REFRESH_TTL_SEC: 604800, MOCK_ERROR_RATE: 0 };
require(path.join(ROOT, "auth/permissionManager"));
require(path.join(ROOT, "auth/jwtManager"));
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
require(path.join(ROOT, "auth/authEngine"));
require(path.join(ROOT, "database/repositories/AuthRepository"));
require(path.join(ROOT, "database/repositories/RoutingRepository"));
require(path.join(ROOT, "database/repositories/LogRepository"));
require(path.join(ROOT, "database/repositories/SettingsRepository"));
const ZwimaDatabase = require(path.join(ROOT, "database/index"));

function request(method, pathname, body, authorization) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path: pathname,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { Authorization: authorization } : {}),
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
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

async function main() {
  const dbReady = ZwimaDatabase.init({ driver: "mock", errorRate: 0, fs, path, mockDir: MOCK_DIR });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    await dbReady;
    const body = req.method === "POST" ? await readBody(req) : undefined;
    try {
      const result = await ZwimaDatabase.queryApi(url.pathname, req.method, body, {
        authorization: req.headers.authorization,
        query: url.search,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: result.data, error: null, timestamp: new Date().toISOString() }));
    } catch (e) {
      res.writeHead(e.code || 401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, data: null, error: { message: e.message, code: e.code || 401 } }));
    }
  });

  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  const results = [];

  async function run(name, fn) {
    try {
      const out = await fn();
      results.push({ name, status: out.status, ok: out.status === 200, detail: out.json?.data || out.json?.error });
    } catch (e) {
      results.push({ name, status: 0, ok: false, detail: e.message });
    }
  }

  let accessToken = "";
  let refreshToken = "";

  await run("Login", async () => {
    const out = await request("POST", "/api/auth/signin", {
      email: "admin@zwima-group.info",
      password: "password123",
      remember: true,
    });
    accessToken = out.json?.data?.tokens?.accessToken || "";
    refreshToken = out.json?.data?.tokens?.refreshToken || "";
    return out;
  });

  await run("Session Restore (GET /api/auth/me)", async () =>
    request("GET", "/api/auth/me", null, `Bearer ${accessToken}`)
  );

  await run("Role Check", async () =>
    request("GET", "/api/auth/role?role=Admin", null, `Bearer ${accessToken}`)
  );

  await run("Permission Check", async () =>
    request("GET", "/api/auth/permissions?permission=billing", null, `Bearer ${accessToken}`)
  );

  await run("Token Refresh", async () => {
    const out = await request("POST", "/api/auth/refresh", { refreshToken });
    accessToken = out.json?.data?.tokens?.accessToken || accessToken;
    refreshToken = out.json?.data?.tokens?.refreshToken || refreshToken;
    return out;
  });

  await run("Protected API (GET /api/providers)", async () =>
    request("GET", "/api/providers", null, `Bearer ${accessToken}`)
  );

  await run("Logout", async () =>
    request("POST", "/api/auth/signout", { refreshToken }, `Bearer ${accessToken}`)
  );

  server.close();

  const passed = results.filter((r) => r.ok).length;
  console.log("\n=== Sprint 10 Auth Tests ===\n");
  results.forEach((r) => {
    console.log(`${r.ok ? "PASS" : "FAIL"}  HTTP ${r.status}  ${r.name}`);
    if (r.detail) console.log("      ", JSON.stringify(r.detail).slice(0, 120));
  });
  console.log(`\n${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
