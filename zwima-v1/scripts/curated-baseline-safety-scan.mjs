#!/usr/bin/env node
/**
 * Safety scans for curated production baseline candidate.
 * Does not print secret values; reports PASS/FAIL only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = {};

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "coverage"].includes(ent.name)) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(abs, acc);
    else acc.push(abs);
  }
  return acc;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*\*.*$/gm, "");
}

// Env files must not be committed in curated tree
const envHits = walk(root).filter((f) => {
  const base = path.basename(f);
  return /^\.env($|\.)/.test(base) && !base.endsWith(".example");
});
const secretPatterns = [
  /sk_live_[A-Za-z0-9]{24,}/,
  /sk_test_[A-Za-z0-9]{24,}/,
  /rk_live_[A-Za-z0-9]{20,}/,
  /whsec_[A-Za-z0-9]{20,}/,
  /-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----/,
];

const appFiles = walk(path.join(root, "src"))
  .concat(walk(path.join(root, "scripts")))
  .concat(walk(path.join(root, "prisma")))
  .filter((f) => /\.(ts|tsx|js|mjs|cjs|prisma)$/i.test(f))
  .filter((f) => !f.includes(`${path.sep}__tests__${path.sep}`))
  .filter((f) => !/\.test\.(ts|tsx)$/.test(f));

let secretHits = envHits.length;
for (const f of envHits) console.log("SECRET_SCAN_ENV_FILE " + path.relative(root, f));
for (const f of appFiles) {
  const t = fs.readFileSync(f, "utf8");
  for (const p of secretPatterns) {
    if (p.test(t)) {
      secretHits += 1;
      console.log("SECRET_SCAN_HIT " + path.relative(root, f));
      break;
    }
  }
}
results.SECRET_SCAN = secretHits === 0 ? "PASS" : "FAIL";

const vercelBuildRaw = fs.readFileSync(path.join(root, "scripts/vercel-build.mjs"), "utf8");
const vercelBuild = stripComments(vercelBuildRaw);
const runCalls = [...vercelBuild.matchAll(/run\(["'`]([^"'`]+)["'`]\)/g)].map((m) => m[1]);
const allowedRuns = new Set(["npx prisma generate", "npx tsc --noEmit", "npx next build"]);
const badRuns = runCalls.filter((c) => !allowedRuns.has(c));
const hasForbiddenExec =
  /\bexecSync\([^)]*(migrate|db push|seed)/i.test(vercelBuild) ||
  badRuns.some((c) => /migrate|db push|seed|provider/i.test(c));
results.AUTO_MIGRATION_ABSENT =
  runCalls.includes("npx prisma generate") &&
  runCalls.includes("npx next build") &&
  !hasForbiddenExec &&
  !runCalls.some((c) => /migrate/.test(c))
    ? "PASS"
    : "FAIL";
results.AUTO_SEED_ABSENT = !runCalls.some((c) => /seed/.test(c)) && !hasForbiddenExec ? "PASS" : "FAIL";
results.FORBIDDEN_BUILD_COMMAND =
  results.AUTO_MIGRATION_ABSENT === "PASS" && results.AUTO_SEED_ABSENT === "PASS" && badRuns.length === 0
    ? "PASS"
    : "FAIL";

const health = fs.readFileSync(path.join(root, "src/app/api/v1/health/route.ts"), "utf8");
const healthWrite = /\.(update|updateMany|upsert|create|delete|deleteMany)\s*\(/.test(health);
results.HEALTH_READONLY = healthWrite ? "PASS" : "PASS";
if (healthWrite) results.HEALTH_READONLY = "FAIL";

const gate = fs.readFileSync(path.join(root, "src/lib/providers/live-provider-gate.ts"), "utf8");
const gateOk =
  /VERCEL_ENV\s*===\s*["']production["']/.test(gate) &&
  /LIVE_PROVIDER_CALLS_ENABLED/.test(gate) &&
  /flag\s*===\s*["']true["']/.test(gate);
results.LIVE_PROVIDER_FAIL_CLOSED = gateOk ? "PASS" : "FAIL";

const stripeGuard = fs.readFileSync(path.join(root, "src/lib/stripe-preview-guard.ts"), "utf8");
results.PREVIEW_STRIPE_BLOCKED = /preview/i.test(stripeGuard) && /throw|Error/.test(stripeGuard) ? "PASS" : "FAIL";

const seed = fs.readFileSync(path.join(root, "src/app/api/v1/agents/seed/route.ts"), "utf8");
const seedGated =
  /AGENT_SEED_AUTHORIZED/.test(seed) &&
  /preview/i.test(seed) &&
  /403/.test(seed);
results.AGENT_SEED_GATED = seedGated ? "PASS" : "FAIL";

results.DATABASE_SIDE_EFFECT_SCAN =
  results.HEALTH_READONLY === "PASS" &&
  results.AUTO_MIGRATION_ABSENT === "PASS" &&
  results.AUTO_SEED_ABSENT === "PASS"
    ? "PASS"
    : "FAIL";

console.log(JSON.stringify(results, null, 2));
if (badRuns.length) console.log("UNEXPECTED_RUN_CALLS", badRuns);
const failed = Object.values(results).some((v) => v === "FAIL");
process.exit(failed ? 1 : 0);
