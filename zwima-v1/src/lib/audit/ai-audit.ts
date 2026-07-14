import { createHash } from "crypto";
import { prisma } from "../prisma";
import type { AuditRequestStatus } from "@prisma/client";

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export type AiAuditInput = {
  requestId: string;
  correlationId?: string;
  organizationId?: string | null;
  userId?: string | null;
  apiKeyId?: string | null;
  providerId?: string | null;
  providerModelId?: string | null;
  routingPolicyId?: string | null;
  requestType?: string;
  capability?: string;
  promptText?: string;
  completionText?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedProviderCost?: number;
  actualProviderCost?: number;
  customerCharge?: number;
  margin?: number;
  latencyMs?: number;
  status: AuditRequestStatus;
  errorCode?: string;
  fallbackCount?: number;
  attemptedProviders?: string[];
  routingReason?: string;
  selectedProvider?: string;
  selectedModel?: string;
  strategy?: string;
  region?: string;
  dataResidency?: string;
  retentionDays?: number;
};

export async function writeAiAudit(input: AiAuditInput): Promise<void> {
  const retentionUntil = input.retentionDays
    ? new Date(Date.now() + input.retentionDays * 86400000)
    : new Date(Date.now() + 365 * 86400000);

  try {
    await prisma.aiAuditLog.create({
      data: {
        requestId: input.requestId,
        correlationId: input.correlationId,
        organizationId: input.organizationId,
        userId: input.userId,
        apiKeyId: input.apiKeyId,
        providerId: input.providerId,
        providerModelId: input.providerModelId || undefined,
        routingPolicyId: input.routingPolicyId,
        requestType: input.requestType ?? "chat",
        capability: input.capability ?? "chat",
        promptHash: input.promptText ? hashContent(input.promptText) : undefined,
        completionHash: input.completionText ? hashContent(input.completionText) : undefined,
        inputTokens: input.inputTokens ?? 0,
        outputTokens: input.outputTokens ?? 0,
        totalTokens: (input.inputTokens ?? 0) + (input.outputTokens ?? 0),
        estimatedProviderCost: input.estimatedProviderCost,
        actualProviderCost: input.actualProviderCost,
        customerCharge: input.customerCharge,
        margin: input.margin,
        status: input.status,
        errorCode: input.errorCode,
        fallbackCount: input.fallbackCount ?? 0,
        attemptedProviders: input.attemptedProviders ?? [],
        routingReason: input.routingReason,
        selectedProvider: input.selectedProvider,
        selectedModel: input.selectedModel,
        strategy: input.strategy,
        region: input.region,
        dataResidency: input.dataResidency,
        retentionUntil,
      },
    });
  } catch (err) {
    // Audit failure must not be silently ignored — log server-side without sensitive data
    console.error("[ai-audit] failed to write audit log", {
      requestId: input.requestId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

export async function updateAiAudit(
  requestId: string,
  data: Partial<AiAuditInput>
): Promise<void> {
  await prisma.aiAuditLog.update({
    where: { requestId },
    data: {
      status: data.status,
      errorCode: data.errorCode,
      actualProviderCost: data.actualProviderCost,
      customerCharge: data.customerCharge,
      margin: data.margin,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      totalTokens: data.inputTokens != null && data.outputTokens != null ? data.inputTokens + data.outputTokens : undefined,
      completionHash: data.completionText ? hashContent(data.completionText) : undefined,
      latencyMs: data.latencyMs,
      fallbackCount: data.fallbackCount,
      attemptedProviders: data.attemptedProviders,
    },
  });
}
