import { getPlatformEnv } from "../env";
import type { CostEstimate } from "../pricing/pricing-service";
import { prisma } from "../prisma";
import type { Prisma, SecurityEventType } from "@prisma/client";

export async function checkMarginProtection(estimate: CostEstimate): Promise<void> {
  const { minMarginPercent } = getPlatformEnv();
  if (estimate.marginPercent < minMarginPercent) {
    await recordSecurityEvent("LOW_MARGIN_ALERT", {
      marginPercent: estimate.marginPercent,
      threshold: minMarginPercent,
      providerCost: estimate.providerCostEur,
    });
    throw new MarginGuardError(
      `Estimated margin ${estimate.marginPercent.toFixed(1)}% below minimum ${minMarginPercent}%`
    );
  }
}

export class MarginGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarginGuardError";
  }
}

export async function recordSecurityEvent(
  type: SecurityEventType,
  details: Record<string, unknown>,
  opts?: { organizationId?: string; apiKeyId?: string; ipAddress?: string; severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }
) {
  await prisma.securityEvent.create({
    data: {
      type,
      severity: opts?.severity ?? "MEDIUM",
      organizationId: opts?.organizationId,
      apiKeyId: opts?.apiKeyId,
      ipAddress: opts?.ipAddress,
      details: details as Prisma.InputJsonValue,
    },
  });
}

export function clampOutputTokens(requested: number | undefined): number {
  const { maxEstimatedOutputTokens } = getPlatformEnv();
  const val = requested ?? 1024;
  return Math.min(val, maxEstimatedOutputTokens);
}
