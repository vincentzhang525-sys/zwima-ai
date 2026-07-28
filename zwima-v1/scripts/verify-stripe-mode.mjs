#!/usr/bin/env node
/** Classify Stripe key mode from Vercel Production/Preview without printing secret bodies. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function classify(raw, role) {
  const key = String(raw ?? "").trim();
  if (!key || key === "[SENSITIVE]") return key === "[SENSITIVE]" ? "sensitive_redacted" : "missing";
  if (/placeholder/i.test(key)) return "placeholder";
  if (role === "secret") {
    if (key.startsWith("sk_test_")) return "test";
    if (key.startsWith("sk_live_")) return "live";
    return "invalid";
  }
  if (key.startsWith("pk_test_")) return "test";
  if (key.startsWith("pk_live_")) return "live";
  return "invalid";
}

function pull(target) {
  const outFile = join(tmpdir(), `zwima-stripe-${target}-${Date.now()}.env`);
  const result = spawnSync("npx", ["vercel", "env", "pull", outFile, "--environment", target, "--yes"], {
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) return { ok: false, error: "pull_failed" };
  try {
    const map = {};
    for (const line of readFileSync(outFile, "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      map[line.slice(0, eq).trim()] = v;
    }
    return {
      ok: true,
      secretKind: classify(map.STRIPE_SECRET_KEY, "secret"),
      publishableKind: classify(map.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, "publishable"),
      previewDisabled: map.STRIPE_PREVIEW_DISABLED === "true",
    };
  } finally {
    try {
      if (existsSync(outFile)) unlinkSync(outFile);
    } catch {
      /* ignore */
    }
  }
}

const report = {
  gap: "GAP-002",
  generatedAt: new Date().toISOString(),
  environments: {
    preview: pull("preview"),
    production: pull("production"),
  },
};
report.productionIsTestMode =
  report.environments.production.ok &&
  report.environments.production.secretKind === "test" &&
  (report.environments.production.publishableKind === "test" ||
    report.environments.production.publishableKind === "sensitive_redacted");
report.overall = report.productionIsTestMode ? "PASS" : "FAIL_NEED_TEST_KEYS";
writeFileSync(join(process.cwd(), ".tmp_gap002_stripe_verify.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.overall === "PASS" ? 0 : 1);
