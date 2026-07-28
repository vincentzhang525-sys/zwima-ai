#!/usr/bin/env npx tsx
/**
 * GAP-014 — Recovery drill CLI.
 * Default: dry-run. Production target always fail-closed. Never restores DB.
 */
import {
  runRecoveryDrill,
  safeLogLine,
  type RecoveryTarget,
} from "../../src/lib/ops/gap014-backup-recovery";

function parseArgs(argv: string[]) {
  const out: { mode: "dry-run" | "execute"; target: RecoveryTarget } = {
    mode: "dry-run",
    target: "preview",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--execute") out.mode = "execute";
    else if (a === "--dry-run") out.mode = "dry-run";
    else if (a === "--target" && argv[i + 1]) {
      out.target = argv[++i] as RecoveryTarget;
    } else if (a.startsWith("--target=")) {
      out.target = a.slice("--target=".length) as RecoveryTarget;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const target: RecoveryTarget =
  args.target === "production" || args.target === "local-ci" ? args.target : "preview";

const result = runRecoveryDrill({
  mode: args.mode,
  target,
  productionRecoveryAuthorized: process.env.PRODUCTION_RECOVERY_AUTHORIZED === "true",
  dbMigrationAuthorized: process.env.DB_MIGRATION_AUTHORIZED === "true",
});

for (const step of result.steps) {
  console.log(safeLogLine(`RECOVERY_STEP ${step}`));
}

const dryPass = result.mode === "dry-run" && result.ok;
console.log(safeLogLine(`DRY_RUN_RECOVERY_STATUS=${dryPass ? "PASS" : result.ok ? "N/A" : "FAIL"}`));
console.log(
  safeLogLine(
    `PRODUCTION_RECOVERY_FAIL_CLOSED=${
      result.code === "PRODUCTION_RECOVERY_FAIL_CLOSED" || result.target !== "production" ? "PASS" : "FAIL"
    }`,
  ),
);
console.log(`PRODUCTION_DATABASE_MODIFIED=${result.productionDatabaseModified ? "YES" : "NO"}`);
console.log(`PRODUCTION_MODIFIED=${result.productionModified ? "YES" : "NO"}`);
console.log(`REAL_PAYMENT_CREATED=${result.realPaymentCreated ? "YES" : "NO"}`);
console.log(`REAL_EMAIL_SENT=${result.realEmailSent ? "YES" : "NO"}`);
console.log(`LIVE_PROVIDER_COST_INCURRED=${result.liveProviderCostIncurred ? "YES" : "NO"}`);
console.log(safeLogLine(`RECOVERY_DRILL_STATUS=${result.status}`));
console.log(safeLogLine(`RECOVERY_DRILL_CODE=${result.code}`));

process.exit(result.ok ? 0 : 1);
