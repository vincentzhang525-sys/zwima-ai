import type { ComplianceWorkspaceRole, OrgRole } from "@prisma/client";
import { classifyRisk } from "./risk-classifier";
import { resolveCompliancePolicy } from "./policy-resolver";
import { recordAIEvent } from "./event-recorder";
import {
  getAuditRecordByAuditId,
  getAuditRecordByEventId,
  verifyAuditIntegrityByAuditId,
  anonymizeAuditRecord,
} from "./audit-service";
import { createHumanReviewCase, updateHumanReviewStatus, listHumanReviewCases } from "./human-review-service";
import { getTransparencyNotice } from "./transparency-service";
import { generateComplianceReport } from "./report-service";
import { dryRunAnonymize, dryRunDelete } from "./retention-service";
import { pickProcessingRegionForProvider } from "./region-service";

/**
 * Facade composing the runtime compliance service layer. API routes and
 * background jobs should generally import from here (or from `./index`)
 * rather than reaching into individual service modules directly, so the
 * public surface can evolve without breaking callers.
 */
export const complianceEngine = {
  classifyRisk,
  resolveCompliancePolicy,
  recordAIEvent,
  getAuditRecordByAuditId,
  getAuditRecordByEventId,
  verifyAuditIntegrityByAuditId,
  anonymizeAuditRecord,
  createHumanReviewCase,
  updateHumanReviewStatus,
  listHumanReviewCases,
  getTransparencyNotice,
  generateComplianceReport,
  dryRunAnonymize,
  dryRunDelete,
  pickProcessingRegionForProvider,
};

export type MinimalComplianceActor = {
  organizationId: string;
  role: OrgRole;
  platformAdmin: boolean;
  complianceRoles: ComplianceWorkspaceRole[];
};

const ROLE_CAN_MANAGE_REVIEW: ComplianceWorkspaceRole[] = ["COMPLIANCE_REVIEWER", "COMPLIANCE_ADMIN"];
const ROLE_CAN_EDIT_POLICY: ComplianceWorkspaceRole[] = ["COMPLIANCE_EDITOR", "COMPLIANCE_ADMIN"];

/** True if the actor may view runtime compliance data (events, audit trail, reports) for their own org. */
export function canViewCompliance(actor: MinimalComplianceActor): boolean {
  void actor;
  return true;
}

/** True if the actor may decide (approve/reject/waive) a human review case. */
export function canDecideHumanReview(actor: MinimalComplianceActor): boolean {
  if (actor.platformAdmin) return true;
  if (actor.role === "OWNER" || actor.role === "ADMIN") return true;
  return actor.complianceRoles.some((r) => ROLE_CAN_MANAGE_REVIEW.includes(r));
}

/** True if the actor may edit a CompliancePolicy (create/update policy versions). */
export function canEditCompliancePolicy(actor: MinimalComplianceActor): boolean {
  if (actor.platformAdmin) return true;
  if (actor.role === "OWNER" || actor.role === "ADMIN") return true;
  return actor.complianceRoles.some((r) => ROLE_CAN_EDIT_POLICY.includes(r));
}

/** True if the actor may generate a compliance report export. */
export function canGenerateComplianceReport(actor: MinimalComplianceActor): boolean {
  return canDecideHumanReview(actor) || canEditCompliancePolicy(actor);
}

export class TenantIsolationError extends Error {
  constructor(expectedOrgId: string, actualOrgId: string | null | undefined) {
    super(`Cross-tenant access denied: resource belongs to a different organization`);
    this.name = "TenantIsolationError";
    void expectedOrgId;
    void actualOrgId;
  }
}

/** Throws unless the resource's organizationId matches the actor's organizationId — the core tenant-isolation guard. */
export function assertSameOrganization(actorOrganizationId: string, resourceOrganizationId: string | null | undefined): void {
  if (!resourceOrganizationId || resourceOrganizationId !== actorOrganizationId) {
    throw new TenantIsolationError(actorOrganizationId, resourceOrganizationId);
  }
}
