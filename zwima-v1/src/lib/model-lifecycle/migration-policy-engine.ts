/**
 * GAP-010 — Migration policy engine (pure evaluation, no live migrate / no spend).
 */

export type MigrationPolicySnapshot = {
  id: string;
  fromModelCode: string;
  toModelCode: string;
  autoMigrate: boolean;
  enabled: boolean;
  status: string;
  requireHumanApproval: boolean;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  fallbackModelCode?: string | null;
};

export type MigrationEvaluation = {
  policyId: string | null;
  rewriteModelCode: string | null;
  applied: boolean;
  skipReason: string | null;
};

export function evaluateMigrationPolicy(
  policy: MigrationPolicySnapshot | null | undefined,
  requestedModelCode: string,
  now: Date = new Date(),
): MigrationEvaluation {
  if (!policy) {
    return { policyId: null, rewriteModelCode: null, applied: false, skipReason: "no_policy" };
  }
  if (!policy.enabled || policy.status !== "ACTIVE") {
    return { policyId: policy.id, rewriteModelCode: null, applied: false, skipReason: "policy_inactive" };
  }
  if (!policy.autoMigrate) {
    return { policyId: policy.id, rewriteModelCode: null, applied: false, skipReason: "auto_migrate_off" };
  }
  if (policy.requireHumanApproval) {
    return {
      policyId: policy.id,
      rewriteModelCode: null,
      applied: false,
      skipReason: "requires_human_approval",
    };
  }
  if (policy.effectiveFrom && policy.effectiveFrom.getTime() > now.getTime()) {
    return { policyId: policy.id, rewriteModelCode: null, applied: false, skipReason: "not_yet_effective" };
  }
  if (policy.effectiveTo && policy.effectiveTo.getTime() <= now.getTime()) {
    return { policyId: policy.id, rewriteModelCode: null, applied: false, skipReason: "expired" };
  }

  const requested = requestedModelCode.trim().toLowerCase();
  const from = policy.fromModelCode.trim().toLowerCase();
  if (requested !== from) {
    return { policyId: policy.id, rewriteModelCode: null, applied: false, skipReason: "model_mismatch" };
  }

  const to = policy.toModelCode.trim();
  if (!to) {
    const fallback = policy.fallbackModelCode?.trim() || null;
    if (!fallback) {
      return { policyId: policy.id, rewriteModelCode: null, applied: false, skipReason: "no_target" };
    }
    return { policyId: policy.id, rewriteModelCode: fallback, applied: true, skipReason: null };
  }

  return { policyId: policy.id, rewriteModelCode: to, applied: true, skipReason: null };
}
