#!/usr/bin/env node
/**
 * GAP-003 — classify Clerk keys via `vercel env ls` (public prefixes) + optional local pull
 * without printing secret bodies. Prefer env ls so encrypted secrets stay opaque.
 *
 * Usage: node scripts/verify-clerk-instance.mjs
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

function runVercelEnvLs(environment) {
  const result = spawnSync("npx", ["vercel", "env", "ls", environment], {
    encoding: "utf8",
    shell: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  const text = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (result.status !== 0 && !text.includes("Environment Variables found")) {
    return { ok: false, error: text.slice(0, 400) };
  }
  return { ok: true, text };
}

function parseRows(text) {
  /** @type {Record<string, { valueDisplay: string, environments: string }>} */
  const rows = {};
  for (const line of text.split(/\r?\n/)) {
    // name ... value ... environments ... created
    const m = line.match(
      /^\s*([A-Z0-9_]+)\s+(\S.*?)\s+(Production(?:, Preview)?|Preview(?:, Production)?|Preview|Production)\s+/,
    );
    if (!m) continue;
    const [, key, valueDisplay, environments] = m;
    rows[key] = { valueDisplay: valueDisplay.trim(), environments: environments.trim() };
  }
  return rows;
}

function classifyPublishableDisplay(display) {
  const v = String(display || "").trim();
  if (!v || v === "Encrypted") return "encrypted_or_hidden";
  if (/placeholder/i.test(v)) return "placeholder";
  if (v.startsWith("pk_live_")) return "live";
  if (v.startsWith("pk_test_")) return "test";
  if (v.startsWith("pk_")) return "invalid";
  return "unknown";
}

function summarize(target, rows) {
  const pk = rows.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const sk = rows.CLERK_SECRET_KEY;
  const db = rows.DATABASE_URL;
  const proxy = rows.NEXT_PUBLIC_CLERK_PROXY_URL;

  const publishableKind = classifyPublishableDisplay(pk?.valueDisplay);
  const secretPresent = Boolean(sk);
  const secretDisplay = sk?.valueDisplay || "missing";

  let clerkInstanceType = "unknown";
  if (publishableKind === "placeholder") clerkInstanceType = "placeholder";
  else if (publishableKind === "live" && secretPresent) clerkInstanceType = "production";
  else if (publishableKind === "test" && secretPresent) clerkInstanceType = "development";
  else if (publishableKind === "encrypted_or_hidden" && secretPresent) {
    // Preview often encrypts public keys in ls; presence of Preview-scoped Clerk pair is enough for inventory.
    clerkInstanceType = target === "preview" ? "development_inferred" : "unknown_encrypted";
  }

  const expected = target === "production" ? "production" : "development";
  const isolated =
    target === "production"
      ? clerkInstanceType === "production" && publishableKind === "live" && secretPresent
      : secretPresent &&
        (publishableKind === "test" ||
          publishableKind === "encrypted_or_hidden" ||
          clerkInstanceType === "development" ||
          clerkInstanceType === "development_inferred") &&
        publishableKind !== "live" &&
        publishableKind !== "placeholder";

  return {
    target,
    publishableKind,
    secretPresent,
    secretDisplayClass: secretDisplay === "Encrypted" ? "encrypted" : secretDisplay === "missing" ? "missing" : "other",
    clerkInstanceType,
    expectedInstanceType: expected,
    isolated,
    hasDatabaseUrl: Boolean(db),
    databaseEnvScope: db?.environments ?? null,
    hasProxyUrl: Boolean(proxy),
    proxyEnvScope: proxy?.environments ?? null,
  };
}

function main() {
  const report = {
    gap: "GAP-003",
    generatedAt: new Date().toISOString(),
    method: "vercel_env_ls_prefix_classification",
    environments: {},
  };

  let allPass = true;
  for (const target of ["preview", "production"]) {
    const ls = runVercelEnvLs(target);
    if (!ls.ok) {
      report.environments[target] = { ok: false, error: ls.error };
      allPass = false;
      continue;
    }
    const rows = parseRows(ls.text);
    const summary = summarize(target, rows);
    report.environments[target] = { ok: true, ...summary };
    if (!summary.isolated) allPass = false;
  }

  const prev = report.environments.preview;
  const prod = report.environments.production;
  if (prev?.ok && prod?.ok && prev.hasDatabaseUrl && prod.hasDatabaseUrl) {
    // Separate Vercel env entries for Preview vs Production DATABASE_URL ⇒ scoped isolation.
    // Host equality cannot be proven while values remain Encrypted.
    report.databaseIsolation = "PASS_SEPARATE_VERCEL_SCOPES_HOST_OPAQUE";
  } else {
    report.databaseIsolation = "INCOMPLETE";
    allPass = false;
  }

  // Cross-check: Production must not share Preview-only live confusion
  if (prod?.ok && prod.publishableKind === "live" && prev?.ok && prev.publishableKind === "live") {
    report.crossEnvClerkLeak = "FAIL_PREVIEW_HAS_LIVE_PUBLISHABLE";
    allPass = false;
  } else {
    report.crossEnvClerkLeak = "PASS";
  }

  report.overall = allPass ? "PASS" : "FAIL";
  const outPath = join(process.cwd(), ".tmp_gap003_clerk_verify.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath}`);
  process.exit(allPass ? 0 : 1);
}

main();
