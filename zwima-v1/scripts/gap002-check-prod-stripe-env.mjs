#!/usr/bin/env node
/**
 * GAP-002 — classify Production Stripe Closed Beta env (no secret bodies).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outFile = join(tmpdir(), `zwima-gap002-env-${Date.now()}.env`);

function parseEnv(text) {
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    map[line.slice(0, eq).trim()] = v;
  }
  return map;
}

function check(name, value, pred, expectedKind) {
  const present = value != null && String(value).trim() !== "";
  const raw = present ? String(value).trim() : "";
  if (!present) {
    return { name, present: false, ok: false, reason: "missing", expectedKind };
  }
  if (raw === "[SENSITIVE]") {
    return { name, present: true, ok: false, reason: "redacted_cannot_verify_prefix", expectedKind };
  }
  if (pred(raw)) {
    return { name, present: true, ok: true, reason: "ok", expectedKind };
  }
  // Extra: detect live keys without printing
  if (name.includes("SECRET_KEY") && raw.startsWith("sk_live_")) {
    return { name, present: true, ok: false, reason: "live_key_not_allowed", expectedKind };
  }
  if (name.includes("PUBLISHABLE") && raw.startsWith("pk_live_")) {
    return { name, present: true, ok: false, reason: "live_key_not_allowed", expectedKind };
  }
  return { name, present: true, ok: false, reason: "wrong_type_or_prefix", expectedKind };
}

const pull = spawnSync(
  "npx",
  ["vercel", "env", "pull", outFile, "--environment", "production", "--yes"],
  { encoding: "utf8", shell: true },
);

if (pull.status !== 0) {
  console.log(JSON.stringify({ allOk: false, error: "env_pull_failed" }, null, 2));
  process.exit(1);
}

try {
  const map = parseEnv(readFileSync(outFile, "utf8"));
  const checks = [
    check("STRIPE_SECRET_KEY", map.STRIPE_SECRET_KEY, (v) => v.startsWith("sk_test_"), "sk_test_"),
    check(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      map.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      (v) => v.startsWith("pk_test_"),
      "pk_test_",
    ),
    check("STRIPE_WEBHOOK_SECRET", map.STRIPE_WEBHOOK_SECRET, (v) => v.startsWith("whsec_"), "whsec_"),
    check("CLOSED_BETA_STRIPE_TEST_ONLY", map.CLOSED_BETA_STRIPE_TEST_ONLY, (v) => v === "true", "true"),
  ];

  // If secrets redacted, prove test mode via Stripe API livemode=false (still no key print).
  let livemodeProbe = null;
  const secret = String(map.STRIPE_SECRET_KEY || "").trim();
  if (secret && secret !== "[SENSITIVE]" && secret.startsWith("sk_")) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(secret, { apiVersion: "2026-06-24.dahlia" });
      const balance = await stripe.balance.retrieve();
      livemodeProbe = { ok: true, livemode: Boolean(balance.livemode) };
      if (balance.livemode === false) {
        const sk = checks.find((c) => c.name === "STRIPE_SECRET_KEY");
        if (sk && sk.reason === "redacted_cannot_verify_prefix") {
          sk.ok = true;
          sk.reason = "ok_via_livemode_false";
        } else if (sk && secret.startsWith("sk_test_")) {
          sk.ok = true;
          sk.reason = "ok";
        }
      }
    } catch {
      livemodeProbe = { ok: false, livemode: null };
    }
  }

  const failed = checks.filter((c) => !c.ok).map((c) => c.name);
  const allOk = failed.length === 0 && livemodeProbe?.livemode !== true;
  console.log(JSON.stringify({ allOk, failed, checks, livemodeProbe }, null, 2));
  process.exit(allOk ? 0 : 2);
} finally {
  try {
    if (existsSync(outFile)) unlinkSync(outFile);
  } catch {
    /* ignore */
  }
}
