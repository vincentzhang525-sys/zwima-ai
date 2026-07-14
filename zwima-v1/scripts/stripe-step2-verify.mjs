#!/usr/bin/env node
/**
 * Phase 7 Step 2 — Stripe env + API + webhook chain verification.
 * Never prints full secrets.
 */
import Stripe from "stripe";
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const BASE = process.env.SMOKE_BASE_URL || "https://zwima-group.info";

const REQUIRED = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
];

function mask(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  if (v.length <= 12) return v.slice(0, 4) + "…";
  return v.slice(0, 8) + "…" + v.slice(-4);
}

function envReport() {
  const rows = REQUIRED.map((key) => {
    const value = process.env[key]?.trim();
    return {
      key,
      configured: !!value,
      prefix: value ? mask(value) : null,
      mode: value?.startsWith("sk_live_") || value?.startsWith("pk_live_")
        ? "live"
        : value?.startsWith("sk_test_") || value?.startsWith("pk_test_")
          ? "test"
          : value
            ? "unknown"
            : null,
    };
  });
  return rows;
}

async function testStripeApi(secretKey) {
  const stripe = new Stripe(secretKey, { apiVersion: "2026-06-24.dahlia" });
  const start = Date.now();
  const balance = await stripe.balance.retrieve();
  const latencyMs = Date.now() - start;
  return {
    ok: true,
    latencyMs,
    livemode: balance.livemode,
    currency: balance.available?.[0]?.currency ?? null,
  };
}

async function getDbClient() {
  const { resolveDirectDatabaseUrl } = await import("../src/lib/database-url.ts");
  const dbUrl = resolveDirectDatabaseUrl();
  const pgUrl = dbUrl.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?&/, "?").replace(/\?$/, "");
  const client = new pg.Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

async function getSmokeUserAndPackage(client) {
  const user = await client.query(`SELECT id, email FROM "User" WHERE email = $1 LIMIT 1`, [
    "smoke-test@zwima-group.info",
  ]);
  const pkg = await client.query(
    `SELECT id, label, "amountEur", credits FROM "CreditPackage" WHERE enabled = true ORDER BY "sortOrder" ASC LIMIT 1`
  );
  const row = pkg.rows[0];
  return {
    userId: user.rows[0]?.id ?? null,
    email: user.rows[0]?.email ?? "smoke-test@zwima-group.info",
    packageId: row?.id ?? null,
    packageLabel: row?.label ?? null,
    credits: row?.credits ?? null,
    amountEur: row?.amountEur ?? null,
  };
}

async function walletCredits(client, userId) {
  const r = await client.query(`SELECT credits FROM "CreditBalance" WHERE "userId" = $1`, [userId]);
  return r.rows[0]?.credits ?? 0;
}

async function testCheckoutSession(stripe, ctx) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || BASE;
  const amountEur = Number(ctx.amountEur);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: ctx.email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: Math.round(amountEur * 100),
          product_data: { name: `ZWIMA Phase7 Verify — ${ctx.credits} credits` },
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/dashboard/billing?success=1`,
    cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
    metadata: {
      userId: ctx.userId,
      credits: String(ctx.credits),
      packageId: ctx.packageId,
      phase7: "verify",
    },
  });
  return { sessionId: session.id, url: session.url, status: session.status };
}

async function insertPendingPayment(client, ctx, sessionId, credits, amountEur) {
  const id = `pay_${randomBytes(8).toString("hex")}`;
  await client.query(
    `INSERT INTO "Payment" (id, "userId", "stripeSessionId", "amountEur", credits, status, "packageId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, NOW(), NOW())`,
    [id, ctx.userId, sessionId, amountEur, credits, ctx.packageId]
  );
  return id;
}

function buildWebhookPayload(session) {
  return {
    id: `evt_${randomBytes(12).toString("hex")}`,
    object: "event",
    type: "checkout.session.completed",
    livemode: session.livemode ?? false,
    data: {
      object: {
        id: session.id,
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        amount_total: session.amount_total,
        payment_intent: session.payment_intent || `pi_${randomBytes(12).toString("hex")}`,
        metadata: session.metadata,
      },
    },
  };
}

async function postWebhook(event, webhookSecret) {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
    timestamp,
  });
  const res = await fetch(`${BASE}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": signed },
    body: payload,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { status: res.status, data };
}

async function main() {
  console.log("=== Phase 7 Step 2 Stripe Verification ===\n");

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    env: envReport(),
    api: null,
    checkout: null,
    webhook: null,
    billing: null,
    pass: false,
  };

  console.log("--- 1. Environment variables ---");
  for (const row of report.env) {
    console.log(`${row.key}: ${row.configured ? `configured (${row.prefix}, ${row.mode})` : "MISSING"}`);
  }

  const missing = report.env.filter((r) => !r.configured).map((r) => r.key);
  if (missing.length) {
    console.log("\nMissing:", missing.join(", "));
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    report.pass = false;
    await writeReport(report);
    process.exit(1);
  }

  console.log("\n--- 2. Stripe API connectivity ---");
  try {
    report.api = await testStripeApi(process.env.STRIPE_SECRET_KEY);
    console.log(`API: PASS | ${report.api.latencyMs}ms | livemode=${report.api.livemode} | currency=${report.api.currency}`);
  } catch (err) {
    report.api = { ok: false, error: err instanceof Error ? err.message : String(err) };
    console.log("API: FAIL —", report.api.error);
  }

  if (missing.length || !process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
    console.log("\n--- 3. Checkout → Webhook → Billing ---");
    console.log("SKIPPED — STRIPE_WEBHOOK_SECRET not configured");
    report.checkout = { skipped: true, reason: "STRIPE_WEBHOOK_SECRET missing" };
    report.webhook = { skipped: true };
    report.billing = { skipped: true };
    report.pass = false;
    await writeReport(report);
    process.exit(1);
  }

  const modes = new Set(report.env.filter((r) => r.mode).map((r) => r.mode));
  if (modes.size > 1 && modes.has("live") && modes.has("test")) {
    console.log("\nWARN: mixed live/test Stripe keys");
  }

  if (!report.api?.ok) {
    report.pass = false;
    await writeReport(report);
    process.exit(1);
  }

  console.log("\n--- 3. Checkout → Webhook → Billing ---");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-06-24.dahlia" });
  let client;
  try {
    client = await getDbClient();
    const ctx = await getSmokeUserAndPackage(client);
    if (!ctx.userId || !ctx.packageId) {
      throw new Error("Smoke user or credit package missing in database");
    }

    const creditsBefore = await walletCredits(client, ctx.userId);
    report.checkout = await testCheckoutSession(stripe, ctx);
    console.log(`Checkout session: ${report.checkout.sessionId} (${report.checkout.status})`);

    const session = await stripe.checkout.sessions.retrieve(report.checkout.sessionId);
    await insertPendingPayment(client, ctx, session.id, ctx.credits, Number(ctx.amountEur));

    const event = buildWebhookPayload(session);
    report.webhook = await postWebhook(event, process.env.STRIPE_WEBHOOK_SECRET);
    console.log(`Webhook POST: HTTP ${report.webhook.status}`, JSON.stringify(report.webhook.data));

    await new Promise((r) => setTimeout(r, 1500));
    const creditsAfter = await walletCredits(client, ctx.userId);
    const payment = await client.query(`SELECT status FROM "Payment" WHERE "stripeSessionId" = $1`, [session.id]);
    const txCount = await client.query(
      `SELECT COUNT(*)::int AS n FROM "Transaction" WHERE "userId" = $1 AND type = 'RECHARGE' AND "createdAt" > NOW() - INTERVAL '5 minutes'`,
      [ctx.userId]
    );

    report.billing = {
      creditsBefore,
      creditsAfter,
      creditsDelta: creditsAfter - creditsBefore,
      paymentStatus: payment.rows[0]?.status ?? null,
      recentRechargeTx: txCount.rows[0]?.n ?? 0,
      pass:
        report.webhook.status === 200 &&
        payment.rows[0]?.status === "COMPLETED" &&
        creditsAfter > creditsBefore,
    };

    console.log(
      `Billing: credits ${creditsBefore} → ${creditsAfter} | payment=${report.billing.paymentStatus} | recharge_tx=${report.billing.recentRechargeTx}`
    );
    console.log("Chain:", report.billing.pass ? "PASS" : "FAIL");

    report.pass =
      report.env.every((r) => r.configured) &&
      report.api?.ok &&
      report.webhook?.status === 200 &&
      report.billing?.pass;
  } catch (err) {
    report.billing = { ok: false, error: err instanceof Error ? err.message : String(err) };
    console.log("Chain FAIL —", report.billing.error);
    report.pass = false;
  } finally {
    await client?.end().catch(() => {});
  }

  console.log("\n=== Overall:", report.pass ? "PASS" : "NOT PASS", "===");
  await writeReport(report);
  process.exit(report.pass ? 0 : 1);
}

async function writeReport(report) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../docs/PHASE7_STEP2_REPORT.md");
  const md = formatMarkdown(report);
  fs.writeFileSync(out, md);
  console.log("\nWrote", out);
}

function formatMarkdown(r) {
  const envRows = r.env
    .map((e) => `| ${e.key} | ${e.configured ? "✅" : "❌"} | ${e.prefix ?? "—"} | ${e.mode ?? "—"} |`)
    .join("\n");

  return `# Phase 7 Step 2 Report — Stripe Production Verification

**Generated:** ${r.generatedAt}  
**Base URL:** ${r.base}  
**Overall:** ${r.pass ? "**PASS**" : "**NOT PASS**"}

## 1. Environment Variables

| Variable | Configured | Prefix | Mode |
|----------|------------|--------|------|
${envRows}

## 2. Stripe API

${r.api?.ok ? `- **PASS** — ${r.api.latencyMs}ms, livemode=${r.api.livemode}, currency=${r.api.currency}` : `- **FAIL** — ${r.api?.error ?? "unknown"}`}

## 3. Checkout → Webhook → Billing

| Step | Result |
|------|--------|
| Checkout session created | ${r.checkout?.sessionId ? `✅ ${r.checkout.sessionId}` : "❌"} |
| Webhook POST | ${r.webhook?.status === 200 ? "✅ HTTP 200" : `❌ HTTP ${r.webhook?.status ?? "—"}`} |
| Payment COMPLETED | ${r.billing?.paymentStatus === "COMPLETED" ? "✅" : "❌"} |
| Credits increased | ${r.billing?.creditsDelta > 0 ? `✅ +${r.billing.creditsDelta}` : "❌"} |
| Recharge transaction | ${r.billing?.recentRechargeTx > 0 ? "✅" : "❌"} |

${r.billing?.pass ? "**Full chain PASS**" : "**Full chain FAIL or incomplete**"}

## 4. Real Payment Test Readiness

${r.pass ? "Production is ready for manual Stripe Checkout payment test (use /dashboard/billing)." : "Fix failures above before live payment test."}
`;
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
