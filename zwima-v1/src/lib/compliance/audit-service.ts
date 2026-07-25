import { prisma } from "../prisma";
import type { ComplianceAuditRecord } from "@prisma/client";
import { verifyIntegrity } from "./integrity";

export async function getAuditRecordByAuditId(auditId: string): Promise<ComplianceAuditRecord | null> {
  return prisma.complianceAuditRecord.findUnique({ where: { auditId } });
}

export async function getAuditRecordByEventId(eventId: string): Promise<ComplianceAuditRecord | null> {
  return prisma.complianceAuditRecord.findUnique({ where: { eventId } });
}

export async function listAuditRecords(params: {
  organizationId: string;
  workspaceId?: string | null;
  limit?: number;
  cursor?: string;
}): Promise<ComplianceAuditRecord[]> {
  return prisma.complianceAuditRecord.findMany({
    where: {
      organizationId: params.organizationId,
      workspaceId: params.workspaceId ?? undefined,
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limit ?? 50, 100),
    ...(params.cursor ? { cursor: { auditId: params.cursor }, skip: 1 } : {}),
  });
}

export type IntegrityVerificationResult = {
  auditId: string;
  valid: boolean;
  anonymized: boolean;
};

/**
 * Recomputes the integrity hash from the record's current field values and
 * compares it to the stored hash. Anonymized records are reported as
 * `anonymized: true` and skipped (their hashed fields were intentionally
 * cleared by retention-service, so recomputation would never match).
 */
export function verifyAuditRecordIntegrity(record: ComplianceAuditRecord): IntegrityVerificationResult {
  if (record.anonymizedAt) {
    return { auditId: record.auditId, valid: true, anonymized: true };
  }
  const valid = verifyIntegrity(
    {
      auditId: record.auditId,
      eventId: record.eventId,
      requestId: record.requestId,
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      provider: record.provider,
      model: record.model,
      riskCategory: record.riskCategory,
      reviewMode: record.reviewMode,
      reviewStatus: record.reviewStatus,
      promptHash: record.promptHash,
      responseHash: record.responseHash,
      estimatedCost: record.estimatedCost ? record.estimatedCost.toString() : null,
      actualCost: record.actualCost ? record.actualCost.toString() : null,
      policyVersion: record.policyVersion,
      disclaimerVersion: record.disclaimerVersion,
      createdAt: record.createdAt,
      previousIntegrityHash: record.previousIntegrityHash,
    },
    record.integrityHash,
  );
  return { auditId: record.auditId, valid, anonymized: false };
}

export async function verifyAuditIntegrityByAuditId(auditId: string): Promise<IntegrityVerificationResult> {
  const record = await getAuditRecordByAuditId(auditId);
  if (!record) throw new Error(`Audit record not found: ${auditId}`);
  return verifyAuditRecordIntegrity(record);
}

/**
 * Anonymizes a sealed audit record in place: clears hash fields and PII
 * pointers while preserving aggregate fields needed for reporting (risk
 * category, cost, timing). Sets `anonymizedAt`. Does not delete the row.
 */
export async function anonymizeAuditRecord(auditId: string): Promise<ComplianceAuditRecord> {
  return prisma.complianceAuditRecord.update({
    where: { auditId },
    data: {
      promptHash: null,
      responseHash: null,
      userId: null,
      apiKeyId: null,
      humanReviewerId: null,
      reviewNotes: null,
      anonymizedAt: new Date(),
    },
  });
}
