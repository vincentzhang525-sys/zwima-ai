/**
 * GAP-010 — Load deprecation/migration policies from Prisma (read-only).
 * Fail-soft: empty index when registry/policy tables have no rows.
 */

import { prisma } from "../prisma";
import type { DeprecationPolicySnapshot } from "./deprecation-policy-engine";
import type { MigrationPolicySnapshot } from "./migration-policy-engine";
import {
  buildLifecyclePolicyIndex,
  policyKey,
  type LifecyclePolicyIndex,
} from "./policy-wiring";

export async function loadLifecyclePolicyIndex(): Promise<LifecyclePolicyIndex> {
  try {
    const [deps, migs] = await Promise.all([
      prisma.modelDeprecationPolicy.findMany({
        where: { archived: false },
        include: {
          registry: { select: { providerSlug: true, modelCode: true } },
          replacementRegistry: { select: { modelCode: true } },
        },
        take: 500,
      }),
      prisma.modelMigrationPolicy.findMany({
        where: { enabled: true, status: "ACTIVE" },
        include: {
          fromRegistry: { select: { providerSlug: true, modelCode: true } },
          toRegistry: { select: { modelCode: true } },
        },
        take: 500,
      }),
    ]);

    const deprecations: DeprecationPolicySnapshot[] = deps.map((d) => ({
      id: d.id,
      status: d.status,
      announcementDate: d.announcementDate,
      deprecationDate: d.deprecationDate,
      sunsetDate: d.sunsetDate,
      disabledAt: d.disabledAt,
      replacementModelCode: d.replacementRegistry?.modelCode ?? null,
      customerMessage: d.customerMessage,
      archived: d.archived,
    }));
    const deprecationKeys = deps.map((d) =>
      policyKey(d.registry.providerSlug, d.registry.modelCode),
    );

    const migrations: MigrationPolicySnapshot[] = migs.map((m) => ({
      id: m.id,
      fromModelCode: m.fromRegistry.modelCode,
      toModelCode: m.toRegistry.modelCode,
      autoMigrate: m.autoMigrate,
      enabled: m.enabled,
      status: m.status,
      requireHumanApproval: m.requireHumanApproval,
      effectiveFrom: m.effectiveFrom,
      effectiveTo: m.effectiveTo,
      fallbackModelCode: null,
    }));
    const migrationFromKeys = migs.map((m) =>
      policyKey(m.fromRegistry.providerSlug, m.fromRegistry.modelCode),
    );

    return buildLifecyclePolicyIndex({
      deprecations,
      migrations,
      deprecationKeys,
      migrationFromKeys,
    });
  } catch {
    // Preview DBs without M5 registry tables populated / transient errors → fail-soft empty
    return buildLifecyclePolicyIndex({
      deprecations: [],
      migrations: [],
      deprecationKeys: [],
      migrationFromKeys: [],
    });
  }
}
