import { prisma } from "../prisma";
import type { RetentionPolicy } from "@prisma/client";
import { anonymizeAuditRecord } from "./audit-service";

export async function getActiveRetentionPolicy(name = "default"): Promise<RetentionPolicy | null> {
  return prisma.retentionPolicy.findFirst({
    where: { name, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
}

export type RetentionCandidate = {
  auditId: string;
  eventId: string;
  organizationId: string;
  createdAt: Date;
  anonymizedAt: Date | null;
};

function cutoffDate(days: number, from = new Date()): Date {
  return new Date(from.getTime() - days * 86_400_000);
}

/**
 * Lists ComplianceAuditRecord rows that WOULD be anonymized under the given
 * retention policy. Pure read — never mutates anything.
 */
export async function dryRunAnonymize(params: {
  policyName?: string;
  organizationId?: string;
  now?: Date;
}): Promise<{ policy: RetentionPolicy | null; candidates: RetentionCandidate[] }> {
  const policy = await getActiveRetentionPolicy(params.policyName ?? "default");
  if (!policy?.anonymizeAfterDays) {
    return { policy, candidates: [] };
  }
  const cutoff = cutoffDate(policy.anonymizeAfterDays, params.now);
  const records = await prisma.complianceAuditRecord.findMany({
    where: {
      organizationId: params.organizationId,
      createdAt: { lt: cutoff },
      anonymizedAt: null,
    },
    select: { auditId: true, eventId: true, organizationId: true, createdAt: true, anonymizedAt: true },
    orderBy: { createdAt: "asc" },
    take: 1000,
  });
  return { policy, candidates: records };
}

/**
 * Lists ComplianceAuditRecord rows that WOULD be eligible for hard deletion
 * under the given retention policy. Pure read — this function itself never
 * deletes anything, regardless of flags; deletion only ever happens via
 * `executeDelete`, and only when explicitly enabled.
 */
export async function dryRunDelete(params: {
  policyName?: string;
  organizationId?: string;
  now?: Date;
}): Promise<{ policy: RetentionPolicy | null; candidates: RetentionCandidate[] }> {
  const policy = await getActiveRetentionPolicy(params.policyName ?? "default");
  if (!policy?.deleteAfterDays) {
    return { policy, candidates: [] };
  }
  const cutoff = cutoffDate(policy.deleteAfterDays, params.now);
  const records = await prisma.complianceAuditRecord.findMany({
    where: {
      organizationId: params.organizationId,
      createdAt: { lt: cutoff },
    },
    select: { auditId: true, eventId: true, organizationId: true, createdAt: true, anonymizedAt: true },
    orderBy: { createdAt: "asc" },
    take: 1000,
  });
  return { policy, candidates: records };
}

export type RetentionExecutionOptions = {
  /** Caller must explicitly pass true — defaults to false everywhere, including tests. */
  enabled: boolean;
};

function retentionExecutionAllowed(options: RetentionExecutionOptions, envFlag: string): boolean {
  return options.enabled === true && process.env[envFlag] === "true";
}

/** Actually anonymizes the given candidates. Guarded by an explicit `enabled` flag AND an env flag. */
export async function executeAnonymize(
  candidates: RetentionCandidate[],
  options: RetentionExecutionOptions,
): Promise<{ anonymized: number; skipped: boolean }> {
  if (!retentionExecutionAllowed(options, "COMPLIANCE_RETENTION_ANONYMIZE_ENABLED")) {
    return { anonymized: 0, skipped: true };
  }
  let count = 0;
  for (const candidate of candidates) {
    await anonymizeAuditRecord(candidate.auditId);
    count += 1;
  }
  return { anonymized: count, skipped: false };
}

/**
 * Hard-deletes candidates. NEVER runs unless BOTH the caller explicitly
 * passes `enabled: true` AND the COMPLIANCE_RETENTION_DELETE_ENABLED env
 * var is set to "true". This double-gate is intentional: retention deletes
 * are destructive and must never trigger accidentally from a cron/test run.
 */
export async function executeDelete(
  candidates: RetentionCandidate[],
  options: RetentionExecutionOptions,
): Promise<{ deleted: number; skipped: boolean }> {
  if (!retentionExecutionAllowed(options, "COMPLIANCE_RETENTION_DELETE_ENABLED")) {
    return { deleted: 0, skipped: true };
  }
  let count = 0;
  for (const candidate of candidates) {
    await prisma.complianceAuditRecord.delete({ where: { auditId: candidate.auditId } });
    count += 1;
  }
  return { deleted: count, skipped: false };
}
