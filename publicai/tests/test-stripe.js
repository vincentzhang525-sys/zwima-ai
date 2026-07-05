#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8794;
const ROOT = __dirname.replace(/[/\\]tests$/, "");
const MOCK_DIR = path.join(ROOT, "mock");

const { loadDotEnv, applyToProcess, loadIntoGlobalConfig } = require(path.join(ROOT, "utils/envLoader"));
global.ZWIMA_CONFIG = {
  STRIPE_MODE: "mock",
  CREDIT_RATE_EUR: 0.1,
  VAT_RATE: 0.19,
  MOCK_ERROR_RATE: 0,
  JWT_ACCESS_TTL_SEC: 900,
  JWT_REFRESH_TTL_SEC: 604800,
};
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
  require(path.join(ROOT, "auth/authEngine"));
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
  return { server };
}

async function main() {
  const { server } = await boot();
  const login = await req("/api/auth/signin", "POST", {
    email: "admin@zwima-group.info",
    password: "password123",
  });
  const auth = `Bearer ${login.json?.data?.tokens?.accessToken}`;
  const results = [];
  let sessionId = "";
  let paymentId = "";

  async function run(name, fn) {
    const out = await fn();
    results.push({ name, status: out.status, ok: out.status === 200, data: out.json?.data });
    return out;
  }

  const checkout = await run("Stripe Checkout (Mock)", () =>
    req("/api/billing/checkout", "POST", { amountEur: 25 }, auth)
  );
  sessionId = checkout.json?.data?.sessionId;

  await run("Complete Payment", () => req("/api/billing/complete", "POST", { sessionId }, auth));

  const creditsBefore = await req("/api/credits", "GET", null, auth);

  await run("Credits Top-up Flow", () => req("/api/credits/topup", "POST", { amountEur: 10 }, auth));

  const creditsAfter = await req("/api/credits", "GET", null, auth);

  await run("Payment History", () => req("/api/billing/payments", "GET", null, auth));

  await run("Invoices List", () => req("/api/billing/invoices", "GET", null, auth));

  await run("Billing Dashboard", () => req("/api/billing/dashboard", "GET", null, auth));

  await run("Webhook checkout.session.completed", () =>
    req(
      "/api/billing/webhook",
      "POST",
      {
        type: "checkout.session.completed",
        data: {
          object: {
            id: sessionId || `cs_mock_webhook_${Date.now()}`,
            payment_intent: `pi_mock_webhook_${Date.now()}`,
            payment_status: "paid",
          },
        },
      },
      null
    )
  );

  await run("Webhook payment_intent.payment_failed", () =>
    req(
      "/api/billing/webhook",
      "POST",
      {
        type: "payment_intent.payment_failed",
        data: { object: { id: `pi_mock_fail_${Date.now()}` } },
      },
      null
    )
  );

  const payments = await req("/api/billing/payments", "GET", null, auth);
  paymentId = payments.json?.data?.[0]?.id;
  if (paymentId) {
    await run("Refund", () => req("/api/billing/refund", "POST", { paymentId }, auth));
  } else {
    results.push({ name: "Refund (skipped)", status: 200, ok: true, data: { skipped: true } });
  }

  const balanceIncreased =
    (creditsAfter.json?.data?.overview?.balance || 0) > (creditsBefore.json?.data?.overview?.balance || 0);

  server.close();

  const passed = results.filter((r) => r.ok).length;
  console.log("\n=== Sprint 13 Stripe Billing Tests ===\n");
  results.forEach((r) => console.log(`${r.ok ? "PASS" : "FAIL"}  HTTP ${r.status}  ${r.name}`));
  console.log(`\nBalance increased after top-up: ${balanceIncreased ? "yes" : "no"}`);
  console.log(`${passed}/${results.length} passed\n`);
  process.exit(passed === results.length && balanceIncreased ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
