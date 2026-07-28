/**
 * GAP-010 — Combined lifecycle policy wiring for routing candidates.
 * Keeps `isRoutableStatus` as the primary status gate; adds policy engines on top.
 * No Production DB writes, no email, no Provider calls.
 */

import type { ProviderModelStatus } from "@prisma/client";
import { isRoutableStatus } from "./lifecycle-service";
import {
  evaluateDeprecationPolicy,
  type DeprecationPolicySnapshot,
} from "./deprecation-policy-engine";
import {
  evaluateMigrationPolicy,
  type MigrationPolicySnapshot,
} from "./migration-policy-engine";

export type LifecycleRoutingDecision = {
  routable: boolean;
  exclusionReason: string | null;
  /** Model code after optional auto-migrate rewrite */
  effectiveModelCode: string;
  migrationApplied: boolean;
  migrationPolicyId: string | null;
  deprecationPolicyId: string | null;
  deprecationAnnounced: boolean;
  replacementHint: string | null;
};

export function resolveLifecycleRoutingDecision(input: {
  modelStatus: ProviderModelStatus;
  modelCode: string;
  vercelEnv?: string;
  now?: Date;
  /** ProviderModel.deprecationDate soft signal (does not alone block if still ACTIVE) */
  modelDeprecationDate?: Date | null;
  modelReplacementCode?: string | null;
  deprecationPolicy?: DeprecationPolicySnapshot | null;
  migrationPolicy?: MigrationPolicySnapshot | null;
}): LifecycleRoutingDecision {
  const now = input.now ?? new Date();
  const statusOk = isRoutableStatus(input.modelStatus, input.vercelEnv);
  if (!statusOk) {
    return {
      routable: false,
      exclusionReason: `Model status ${input.modelStatus} not routable`,
      effectiveModelCode: input.modelCode,
      migrationApplied: false,
      migrationPolicyId: null,
      deprecationPolicyId: null,
      deprecationAnnounced: false,
      replacementHint: input.modelReplacementCode ?? null,
    };
  }

  const dep = evaluateDeprecationPolicy(input.deprecationPolicy, now);
  if (!dep.routable) {
    return {
      routable: false,
      exclusionReason: dep.excludeReason,
      effectiveModelCode: input.modelCode,
      migrationApplied: false,
      migrationPolicyId: null,
      deprecationPolicyId: dep.policyId,
      deprecationAnnounced: dep.announced,
      replacementHint: dep.replacementModelCode ?? input.modelReplacementCode ?? null,
    };
  }

  const mig = evaluateMigrationPolicy(input.migrationPolicy, input.modelCode, now);
  const effectiveModelCode = mig.applied && mig.rewriteModelCode ? mig.rewriteModelCode : input.modelCode;

  return {
    routable: true,
    exclusionReason: null,
    effectiveModelCode,
    migrationApplied: mig.applied,
    migrationPolicyId: mig.policyId,
    deprecationPolicyId: dep.policyId,
    deprecationAnnounced: dep.announced,
    replacementHint: dep.replacementModelCode ?? input.modelReplacementCode ?? null,
  };
}

export type LifecyclePolicyIndex = {
  deprecationByKey: Map<string, DeprecationPolicySnapshot>;
  migrationByFromKey: Map<string, MigrationPolicySnapshot>;
};

export function policyKey(providerSlug: string, modelCode: string): string {
  return `${providerSlug.trim().toLowerCase()}::${modelCode.trim().toLowerCase()}`;
}

export function buildLifecyclePolicyIndex(input: {
  deprecations: DeprecationPolicySnapshot[];
  migrations: MigrationPolicySnapshot[];
  /** Maps policy model codes that already include provider context via key builder outside */
  deprecationKeys: string[];
  migrationFromKeys: string[];
}): LifecyclePolicyIndex {
  const deprecationByKey = new Map<string, DeprecationPolicySnapshot>();
  input.deprecations.forEach((p, i) => {
    const key = input.deprecationKeys[i];
    if (key) deprecationByKey.set(key, p);
  });
  const migrationByFromKey = new Map<string, MigrationPolicySnapshot>();
  input.migrations.forEach((p, i) => {
    const key = input.migrationFromKeys[i];
    if (key) migrationByFromKey.set(key, p);
  });
  return { deprecationByKey, migrationByFromKey };
}

export function lookupPolicies(
  index: LifecyclePolicyIndex | null | undefined,
  providerSlug: string,
  modelCode: string,
): {
  deprecationPolicy: DeprecationPolicySnapshot | null;
  migrationPolicy: MigrationPolicySnapshot | null;
} {
  if (!index) return { deprecationPolicy: null, migrationPolicy: null };
  const key = policyKey(providerSlug, modelCode);
  return {
    deprecationPolicy: index.deprecationByKey.get(key) ?? null,
    migrationPolicy: index.migrationByFromKey.get(key) ?? null,
  };
}
