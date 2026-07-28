#!/usr/bin/env node
/**
 * Classify Stripe Closed Beta env from process.env (no secret bodies printed).
 * Intended to run via: vercel env run -e production -- node scripts/gap002-classify-runtime-env.mjs
 */
function check(name, pred, expectedKind) {
  const raw = String(process.env[name] ?? "").trim();
  if (!raw) return { name, present: false, ok: false, reason: "missing", expectedKind };
  if (raw === "[SENSITIVE]") {
    return { name, present: true, ok: false, reason: "redacted_cannot_verify_prefix", expectedKind };
  }
  if (pred(raw)) return { name, present: true, ok: true, reason: "ok", expectedKind };
  if (name === "STRIPE_SECRET_KEY" && raw.startsWith("sk_live_")) {
    return { name, present: true, ok: false, reason: "live_key_not_allowed", expectedKind };
  }
  if (name === "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" && raw.startsWith("pk_live_")) {
    return { name, present: true, ok: false, reason: "live_key_not_allowed", expectedKind };
  }
  return { name, present: true, ok: false, reason: "wrong_type_or_prefix", expectedKind };
}

const checks = [
  check("STRIPE_SECRET_KEY", (v) => v.startsWith("sk_test_"), "sk_test_"),
  check("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", (v) => v.startsWith("pk_test_"), "pk_test_"),
  check("STRIPE_WEBHOOK_SECRET", (v) => v.startsWith("whsec_"), "whsec_"),
  check("CLOSED_BETA_STRIPE_TEST_ONLY", (v) => v === "true", "true"),
];

let livemode = null;
const sk = String(process.env.STRIPE_SECRET_KEY || "").trim();
if (sk.startsWith("sk_test_") || sk.startsWith("sk_live_")) {
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(sk, { apiVersion: "2026-06-24.dahlia" });
    const balance = await stripe.balance.retrieve();
    livemode = Boolean(balance.livemode);
  } catch {
    livemode = "api_error";
  }
}

const failed = checks.filter((c) => !c.ok).map((c) => c.name);
const allOk = failed.length === 0 && livemode !== true;
console.log(JSON.stringify({ allOk, failed, checks, livemode }, null, 2));
process.exit(allOk ? 0 : 2);
