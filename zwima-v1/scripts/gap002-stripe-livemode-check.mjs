#!/usr/bin/env node
/**
 * GAP-002 — detect Stripe livemode via API using pulled Production secret (never printed).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Stripe from "stripe";

const outFile = join(tmpdir(), `zwima-stripe-livecheck-${Date.now()}.env`);

function parseEnv(text) {
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    map[line.slice(0, eq).trim()] = v;
  }
  return map;
}

function prefixClass(raw, role) {
  const key = String(raw ?? "").trim();
  if (!key) return "missing";
  if (key === "[SENSITIVE]") return "redacted";
  if (role === "secret") {
    if (key.startsWith("sk_test_")) return "test";
    if (key.startsWith("sk_live_")) return "live";
    return "other";
  }
  if (key.startsWith("pk_test_")) return "test";
  if (key.startsWith("pk_live_")) return "live";
  return "other";
}

try {
  const pull = spawnSync(
    "npx",
    ["vercel", "env", "pull", outFile, "--environment", "production", "--yes"],
    { encoding: "utf8", shell: true },
  );
  if (pull.status !== 0) {
    console.log(JSON.stringify({ ok: false, error: "env_pull_failed" }));
    process.exit(1);
  }
  const map = parseEnv(readFileSync(outFile, "utf8"));
  const secretClass = prefixClass(map.STRIPE_SECRET_KEY, "secret");
  const pubClass = prefixClass(map.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, "publishable");

  let livemode = null;
  let apiOk = false;
  if (secretClass === "test" || secretClass === "live") {
    try {
      const stripe = new Stripe(map.STRIPE_SECRET_KEY, { apiVersion: "2026-06-24.dahlia" });
      const balance = await stripe.balance.retrieve();
      livemode = Boolean(balance.livemode);
      apiOk = true;
    } catch (err) {
      console.log(
        JSON.stringify({
          ok: false,
          secretClass,
          pubClass,
          apiOk: false,
          apiError: "stripe_balance_failed",
        }),
      );
      process.exit(1);
    }
  }

  const isTestMode = secretClass === "test" || livemode === false;
  const report = {
    ok: apiOk ? !livemode : secretClass === "test",
    secretClass,
    pubClass,
    livemode,
    apiOk,
    closedBetaRequiresTest: true,
    result: isTestMode && livemode !== true ? "TEST_MODE" : "LIVE_OR_UNKNOWN",
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.result === "TEST_MODE" ? 0 : 2);
} finally {
  try {
    if (existsSync(outFile)) unlinkSync(outFile);
  } catch {
    /* ignore */
  }
}
