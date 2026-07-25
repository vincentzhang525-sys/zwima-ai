import { hashText } from "./hashes";

/**
 * Canonical field set used to compute the tamper-evident integrity hash for
 * a ComplianceAuditRecord. Any change to these fields after the record is
 * sealed will change the hash, which lets audit-service detect tampering.
 *
 * previousIntegrityHash is included so records form a hash chain — each
 * audit record's hash is influenced by the hash of the record before it
 * for the same organization, similar to a lightweight append-only ledger.
 */
export type IntegrityFields = {
  auditId: string;
  eventId: string;
  requestId: string;
  organizationId: string;
  workspaceId?: string | null;
  provider: string;
  model: string;
  riskCategory: string;
  reviewMode: string;
  reviewStatus: string;
  promptHash?: string | null;
  responseHash?: string | null;
  estimatedCost?: number | string | null;
  actualCost?: number | string | null;
  policyVersion?: string | null;
  disclaimerVersion?: string | null;
  createdAt: string | Date;
  previousIntegrityHash?: string | null;
};

function canonicalize(fields: IntegrityFields): string {
  const createdAtIso = fields.createdAt instanceof Date ? fields.createdAt.toISOString() : fields.createdAt;
  const parts = [
    fields.auditId,
    fields.eventId,
    fields.requestId,
    fields.organizationId,
    fields.workspaceId ?? "",
    fields.provider,
    fields.model,
    fields.riskCategory,
    fields.reviewMode,
    fields.reviewStatus,
    fields.promptHash ?? "",
    fields.responseHash ?? "",
    fields.estimatedCost != null ? String(fields.estimatedCost) : "",
    fields.actualCost != null ? String(fields.actualCost) : "",
    fields.policyVersion ?? "",
    fields.disclaimerVersion ?? "",
    createdAtIso,
    fields.previousIntegrityHash ?? "",
  ];
  return parts.join("|");
}

export function computeIntegrityHash(fields: IntegrityFields): string {
  return hashText(canonicalize(fields));
}

export function verifyIntegrity(fields: IntegrityFields, expectedHash: string): boolean {
  return computeIntegrityHash(fields) === expectedHash;
}
