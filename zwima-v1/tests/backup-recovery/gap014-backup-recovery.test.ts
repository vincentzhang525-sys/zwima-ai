/**
 * GAP-014 — Backup & Recovery automated verification (no Production I/O).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  REQUIRED_ENV_NAMES,
  assertEnvManifestCoverage,
  parseEnvExampleKeys,
  redactSecrets,
  runRecoveryDrill,
  safeLogLine,
  summarizeDbHost,
} from "../../src/lib/ops/gap014-backup-recovery";

const root = path.resolve(__dirname, "../..");

describe("GAP-014 backup & recovery gate", () => {
  it("keeps manifest and runbook present with required topics", () => {
    const manifest = fs.readFileSync(path.join(root, "docs/ZWIMA_AI_BACKUP_MANIFEST.md"), "utf8");
    const runbook = fs.readFileSync(path.join(root, "docs/ZWIMA_AI_BACKUP_RECOVERY_RUNBOOK.md"), "utf8");
    expect(manifest).toMatch(/Supabase/);
    expect(manifest).toMatch(/PITR/);
    expect(runbook).toMatch(/dry-run/i);
    expect(runbook).toMatch(/fail-closed/i);
    expect(runbook).toMatch(/rollback/i);
    expect(runbook).toMatch(/Point-in-Time/);
  });

  it("verifies prisma migrations are on-disk recoverable", () => {
    const migDir = path.join(root, "prisma/migrations");
    const dirs = fs
      .readdirSync(migDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name));
    expect(dirs.length).toBeGreaterThan(0);
    for (const d of dirs) {
      expect(fs.existsSync(path.join(migDir, d.name, "migration.sql"))).toBe(true);
    }
    expect(fs.existsSync(path.join(migDir, "migration_lock.toml"))).toBe(true);
    expect(fs.existsSync(path.join(root, "prisma/schema.prisma"))).toBe(true);
  });

  it("covers required env names vs .env.example without reading secret values", () => {
    const example = fs.readFileSync(path.join(root, ".env.example"), "utf8");
    const keys = parseEnvExampleKeys(example);
    const coverage = assertEnvManifestCoverage(keys);
    expect(coverage.missingFromExample).toEqual([]);
    expect(REQUIRED_ENV_NAMES.length).toBeGreaterThan(10);
  });

  it("dry-run recovery passes for preview and never marks Production modified", () => {
    const result = runRecoveryDrill({ mode: "dry-run", target: "preview" });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("PASS");
    expect(result.code).toBe("DRY_RUN_OK");
    expect(result.productionDatabaseModified).toBe(false);
    expect(result.productionModified).toBe(false);
    expect(result.realPaymentCreated).toBe(false);
    expect(result.realEmailSent).toBe(false);
    expect(result.liveProviderCostIncurred).toBe(false);
  });

  it("fail-closes Production recovery even if authorization env is claimed", () => {
    const result = runRecoveryDrill({
      mode: "dry-run",
      target: "production",
      productionRecoveryAuthorized: true,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("PRODUCTION_RECOVERY_FAIL_CLOSED");
    expect(result.productionDatabaseModified).toBe(false);
  });

  it("refuses execute mode and migrate-authorized drills", () => {
    expect(runRecoveryDrill({ mode: "execute", target: "preview" }).code).toBe("EXECUTE_FORBIDDEN");
    expect(
      runRecoveryDrill({ mode: "dry-run", target: "preview", dbMigrationAuthorized: true }).code,
    ).toBe("MIGRATE_FORBIDDEN_IN_DRILL");
  });

  it("redacts secrets, URLs, and emails from log lines", () => {
    const dirty =
      "postgres://user:secretpass@db.example.com:5432/app sk_live_abcdefghijklmnopqrstuv " +
      "whsec_abcdefghijklmnopqrstuv re_abcdefghijklmnopqrstuv Bearer eyJhbGciOiJIUzI1NiJ9.aaa.bbb " +
      "admin@example.com";
    const cleaned = safeLogLine(dirty);
    expect(cleaned).not.toMatch(/secretpass/);
    expect(cleaned).not.toMatch(/sk_live_/);
    expect(cleaned).not.toMatch(/whsec_/);
    expect(cleaned).not.toMatch(/re_/);
    expect(cleaned).not.toMatch(/example\.com/);
    expect(cleaned).toMatch(/REDACTED/);
    expect(redactSecrets("pk_test_abcdefghijklmnop")).toMatch(/REDACTED/);
  });

  it("summarizes DB hosts without echoing the full URL", () => {
    const summary = summarizeDbHost("postgresql://u:p@prod-db.example.com:5432/zwima");
    expect(summary.present).toBe(true);
    expect(summary.hostPrefix).not.toContain("postgresql://");
    expect(summary.hostPrefix).not.toContain("u:p");
    expect(summary.looksProd).toBe(true);
  });

  it("ships backup/recovery CLIs", () => {
    expect(fs.existsSync(path.join(root, "scripts/backup/gap014-backup-capability-check.ts"))).toBe(true);
    expect(fs.existsSync(path.join(root, "scripts/recovery/gap014-recovery-drill.ts"))).toBe(true);
  });
});
