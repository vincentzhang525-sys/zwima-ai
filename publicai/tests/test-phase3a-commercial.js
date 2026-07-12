#!/usr/bin/env node
/**
 * Phase 3A — Commercial activation foundation unit tests (no production side effects)
 */
const crypto = require("crypto");
const path = require("path");

const root = path.resolve(__dirname, "..");
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

function clearModule(subpath) {
  const full = path.join(root, subpath);
  try {
    delete require.cache[require.resolve(full)];
  } catch {
    /* ignore */
  }
}

function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

async function withEnvAsync(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

async function main() {
  console.log("\n=== Phase 3A Commercial Foundation Tests ===\n");

  const stripeClient = require(path.join(root, "api/lib/payments/stripeClient.js"));
  const redact = require(path.join(root, "api/lib/email/redact.js"));
  const company = require(path.join(root, "api/lib/commercial/companyConfig.js"));

  withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      EMAIL_PROVIDER: "smtp",
      COMMERCIAL_BETA_MODE: "false",
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      SMTP_FROM: "",
    },
    () => {
      clearModule("api/lib/email/policy.js");
      clearModule("api/lib/commercial/environment.js");
      const p = require(path.join(root, "api/lib/email/policy.js"));
      const e = require(path.join(root, "api/lib/commercial/environment.js"));
      if (p.resolveProviderKind() === "fail-closed") pass("Email production fail-closed without SMTP");
      else fail("Email production fail-closed without SMTP", p.resolveProviderKind());
      if (e.emailMustFailClosed()) pass("Environment emailMustFailClosed");
      else fail("Environment emailMustFailClosed");
    }
  );

  withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      EMAIL_PROVIDER: "smtp",
      COMMERCIAL_BETA_MODE: "true",
      SMTP_HOST: "",
    },
    () => {
      clearModule("api/lib/commercial/environment.js");
      const e = require(path.join(root, "api/lib/commercial/environment.js"));
      if (e.emailProviderKind() === "mock-beta") pass("Email mock-beta when COMMERCIAL_BETA_MODE");
      else fail("Email mock-beta when COMMERCIAL_BETA_MODE", e.emailProviderKind());
    }
  );

  withEnv(
    {
      NODE_ENV: "development",
      VERCEL_ENV: "development",
      EMAIL_PROVIDER: "smtp",
    },
    () => {
      clearModule("api/lib/email/policy.js");
      const p = require(path.join(root, "api/lib/email/policy.js"));
      if (p.resolveProviderKind() === "mock") pass("Email mock isolated in local/dev");
      else fail("Email mock isolated in local/dev", p.resolveProviderKind());
    }
  );

  withEnv(
    {
      STRIPE_MODE: "live",
      STRIPE_SECRET_KEY: "",
      COMMERCIAL_BETA_MODE: "false",
    },
    () => {
      clearModule("api/lib/commercial/environment.js");
      clearModule("api/lib/payments/stripeConfig.js");
      const e = require(path.join(root, "api/lib/commercial/environment.js"));
      const s = require(path.join(root, "api/lib/payments/stripeConfig.js"));
      if (e.paymentMustFailClosed()) pass("Stripe live fail-closed without keys");
      else fail("Stripe live fail-closed without keys");
      try {
        s.assertStripeOperational();
        fail("assertStripeOperational throws on live misconfig");
      } catch (err) {
        if (err.code === "STRIPE_MISCONFIGURED") pass("assertStripeOperational throws STRIPE_MISCONFIGURED");
        else fail("assertStripeOperational throws STRIPE_MISCONFIGURED", err.code);
      }
    }
  );

  withEnv(
    {
      STRIPE_MODE: "mock",
      STRIPE_SECRET_KEY: "",
      COMMERCIAL_BETA_MODE: "true",
    },
    () => {
      clearModule("api/lib/payments/stripeConfig.js");
      const s = require(path.join(root, "api/lib/payments/stripeConfig.js"));
      if (s.isRealStripeMode() === false) pass("Stripe mock mode avoids real checkout");
      else fail("Stripe mock mode avoids real checkout");
    }
  );

  const secret = "whsec_test_secret";
  const payload = JSON.stringify({ id: "evt_test", type: "checkout.session.completed" });
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const header = `t=${timestamp},v1=${signed}`;
  if (stripeClient.verifyWebhookSignature(payload, header, secret)) pass("Stripe signature validation accepts valid signature");
  else fail("Stripe signature validation accepts valid signature");
  if (!stripeClient.verifyWebhookSignature(payload, header, "wrong")) pass("Stripe signature validation rejects invalid secret");
  else fail("Stripe signature validation rejects invalid secret");

  process.env.SMTP_PASS = "super-secret-pass";
  const sanitized = redact.sanitizeLogMessage("Failed auth super-secret-pass for user");
  if (!sanitized.includes("super-secret-pass")) pass("Secret redaction in logs");
  else fail("Secret redaction in logs");
  delete process.env.SMTP_PASS;

  const missing = company.getMissingLegalFields();
  if (missing.some((f) => f.field === "managingDirector")) pass("Legal missing fields tracked");
  else fail("Legal missing fields tracked");
  if (company.getCompanyConfig().legalName === "Zwima Technologie GmbH") pass("Company config legal name");
  else fail("Company config legal name");

  await withEnvAsync({ STRIPE_MODE: "mock", VERCEL: "1", VERCEL_ENV: "production", NODE_ENV: "production" }, async () => {
    clearModule("api/lib/commercial/environment.js");
    clearModule("api/lib/payments/stripeConfig.js");
    clearModule("api/lib/payments/StripePaymentProvider.js");
    const StripePaymentProvider = require(path.join(root, "api/lib/payments/StripePaymentProvider.js"));
    const provider = new StripePaymentProvider();
    try {
      await provider.createCheckout({ userId: "user-1", plan: "starter", amountEur: 29, credits: 1000 });
      fail("Production mock checkout blocked");
    } catch (err) {
      if (err.code === "STRIPE_MISCONFIGURED") pass("Production mock checkout blocked");
      else fail("Production mock checkout blocked", err.message);
    }
  });

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
