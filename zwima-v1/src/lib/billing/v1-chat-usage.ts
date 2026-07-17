import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-errors";
import { chargeForUsage, countMessageTokens } from "@/lib/billing/credits-engine";
import type { UserTier } from "@prisma/client";

export type V1ChatUsageKeyContext = {
  userId: string;
  apiKeyId: string;
  organizationId: string;
  userTier?: UserTier;
};

export type PersistV1ChatUsageParams = {
  key: V1ChatUsageKeyContext;
  requestId: string;
  providerSlug: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  messages?: { content: string }[];
  /** When true, provider reported non-zero usage fields. */
  providerReportedUsage: boolean;
  workspaceId?: string | null;
};

export type PersistV1ChatUsageResult = {
  costCredits: number;
  usageLogId: string;
  providerCost: number;
  usageSource: "provider" | "estimated";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  replayed: boolean;
};

async function resolveProviderId(slug: string): Promise<string> {
  const row = await prisma.provider.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!row) {
    throw new ApiError(
      "BILLING_PERSISTENCE_FAILED",
      `Provider "${slug}" is not registered in the database.`,
      502,
    );
  }
  return row.id;
}

function resolveTokens(params: PersistV1ChatUsageParams): {
  inputTokens: number;
  outputTokens: number;
  usageSource: "provider" | "estimated";
} {
  if (
    params.providerReportedUsage &&
    (params.inputTokens > 0 || params.outputTokens > 0)
  ) {
    return {
      inputTokens: Math.max(0, params.inputTokens),
      outputTokens: Math.max(0, params.outputTokens),
      usageSource: "provider",
    };
  }

  const estimatedIn = params.messages?.length
    ? countMessageTokens(params.messages)
    : Math.max(1, params.inputTokens || 1);
  const estimatedOut = Math.max(1, params.outputTokens || 1);
  return {
    inputTokens: estimatedIn,
    outputTokens: estimatedOut,
    usageSource: "estimated",
  };
}

/**
 * Persist chat usage after a successful Provider call.
 * Idempotent on requestId — replays do not double-charge.
 */
export async function persistV1ChatUsage(
  params: PersistV1ChatUsageParams,
): Promise<PersistV1ChatUsageResult> {
  const tokens = resolveTokens(params);
  const providerId = await resolveProviderId(params.providerSlug);

  try {
    const charged = await chargeForUsage({
      userId: params.key.userId,
      apiKeyId: params.key.apiKeyId,
      providerId,
      providerSlug: params.providerSlug,
      model: params.model,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      latencyMs: params.latencyMs,
      userTier: params.key.userTier,
      requestId: params.requestId,
      usageSource: tokens.usageSource,
      organizationId: params.key.organizationId,
      workspaceId: params.workspaceId ?? null,
    });

    await prisma.auditLog.create({
      data: {
        userId: params.key.userId,
        action: charged.replayed ? "API_CHAT_USAGE_REPLAY" : "API_CHAT_USAGE",
        category: "BILLING",
        detail: {
          requestId: params.requestId,
          usageLogId: charged.usageLogId,
          provider: params.providerSlug,
          model: params.model,
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
          totalTokens: tokens.inputTokens + tokens.outputTokens,
          costCredits: charged.costCredits,
          providerCost: charged.providerCost,
          currency: "CREDITS",
          usageSource: tokens.usageSource,
          latencyMs: params.latencyMs,
          organizationId: params.key.organizationId,
          workspaceId: params.workspaceId ?? null,
          apiKeyId: params.key.apiKeyId,
          status: "SUCCESS",
          compensationStatus: charged.replayed ? "IDEMPOTENT_REPLAY" : "CHARGED",
        },
      },
    });

    return {
      costCredits: charged.costCredits,
      usageLogId: charged.usageLogId,
      providerCost: Number(charged.providerCost),
      usageSource: tokens.usageSource,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      totalTokens: tokens.inputTokens + tokens.outputTokens,
      replayed: Boolean(charged.replayed),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Billing persistence failed";

    await prisma.auditLog
      .create({
        data: {
          userId: params.key.userId,
          action: "API_CHAT_BILLING_FAILED",
          category: "BILLING",
          detail: {
            requestId: params.requestId,
            provider: params.providerSlug,
            model: params.model,
            status: "PROVIDER_OK_BILLING_FAILED",
            compensationStatus: "NEEDS_RECONCILIATION",
            error: message.slice(0, 500),
          },
        },
      })
      .catch(() => undefined);

    if (message === "Insufficient credits") {
      throw new ApiError("INSUFFICIENT_CREDITS", "Insufficient credits.", 402, params.requestId);
    }

    throw new ApiError(
      "BILLING_PERSISTENCE_FAILED",
      `Provider call succeeded but usage could not be persisted: ${message}`,
      502,
      params.requestId,
    );
  }
}
