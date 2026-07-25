import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { hashTextOrNull } from "./hashes";
import { computeIntegrityHash } from "./integrity";
import { resolveCompliancePolicy } from "./policy-resolver";
import { pickProcessingRegionForProvider } from "./region-service";
import type { PolicyResolutionResult, RecordAIEventInput, RecordAIEventResult } from "./types";

function newEventId(): string {
  return `evt_${randomUUID()}`;
}

function newAuditId(): string {
  return `adt_${randomUUID()}`;
}

function newCaseId(): string {
  return `rev_${randomUUID()}`;
}

type ResolvedEventRegions = {
  processingRegion: string | null;
  inferenceRegion: string | null;
  dataResidencyRegion: string | null;
  providerRegion: string | null;
};

/**
 * Resolves the four region fields persisted on AIEvent/ComplianceAuditRecord.
 * Explicit input overrides always win. Otherwise falls back to
 * `pickProcessingRegionForProvider`, honoring the resolved policy's
 * `requireEuProcessing`/`allowedRegions`. Never throws — if no
 * ProviderRegionCapability rows are registered (or the lookup fails for any
 * reason), all four fields simply resolve to `null` rather than blocking
 * event recording.
 */
async function resolveEventRegions(
  input: RecordAIEventInput,
  resolution: PolicyResolutionResult,
): Promise<ResolvedEventRegions> {
  const hasOverride =
    input.processingRegion !== undefined ||
    input.inferenceRegion !== undefined ||
    input.dataResidencyRegion !== undefined ||
    input.providerRegion !== undefined;

  if (hasOverride) {
    const processingRegion = input.processingRegion ?? null;
    return {
      processingRegion,
      inferenceRegion: input.inferenceRegion ?? processingRegion,
      dataResidencyRegion: input.dataResidencyRegion ?? null,
      providerRegion: input.providerRegion ?? processingRegion,
    };
  }

  try {
    const picked = await pickProcessingRegionForProvider({
      provider: input.provider,
      requireEuProcessing: resolution.policy.requireEuProcessing,
      allowedRegions: resolution.policy.allowedRegions.length ? resolution.policy.allowedRegions : undefined,
    });
    return {
      processingRegion: picked.regionCode,
      inferenceRegion: picked.regionCode,
      dataResidencyRegion: picked.regionCode && picked.isEuEea ? picked.regionCode : null,
      providerRegion: picked.regionCode,
    };
  } catch {
    return { processingRegion: null, inferenceRegion: null, dataResidencyRegion: null, providerRegion: null };
  }
}

async function findExistingByIdempotency(
  idempotencyKey: string | null | undefined,
  requestId: string,
) {
  if (idempotencyKey) {
    const byKey = await prisma.aIEvent.findFirst({
      where: { idempotencyKey },
      include: { complianceAudit: true, reviewCases: true },
    });
    if (byKey) return byKey;
  }
  return prisma.aIEvent.findUnique({
    where: { requestId },
    include: { complianceAudit: true, reviewCases: true },
  });
}

function toIdempotentResult(existing: NonNullable<Awaited<ReturnType<typeof findExistingByIdempotency>>>): RecordAIEventResult {
  const reviewCase = existing.reviewCases?.[0] ?? null;
  return {
    eventId: existing.eventId,
    auditId: existing.complianceAudit?.auditId ?? "",
    riskCategory: existing.riskCategory,
    reviewStatus: existing.reviewStatus,
    reviewMode: existing.reviewMode,
    reviewCaseId: reviewCase?.caseId ?? null,
    blocked: existing.status === "BLOCKED",
    blockReason: existing.status === "BLOCKED" ? "Duplicate of a previously blocked request" : null,
    idempotent: true,
  };
}

/**
 * Records a single AI runtime event as one atomic operation: the AIEvent
 * row, its linked immutable ComplianceAuditRecord, and (if the resolved
 * policy/risk requires it) a HumanReviewCase + initial history entry.
 *
 * Idempotent by `idempotencyKey` (preferred) or `requestId` (unique) — a
 * duplicate call returns the original result instead of creating a second
 * event. Prompt/response text is hashed immediately and the plaintext is
 * never passed to Prisma.
 */
export async function recordAIEvent(input: RecordAIEventInput): Promise<RecordAIEventResult> {
  const existing = await findExistingByIdempotency(input.idempotencyKey, input.requestId);
  if (existing) return toIdempotentResult(existing);

  const resolution = await resolveCompliancePolicy({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId ?? null,
    provider: input.provider,
    model: input.model,
  });

  const eventId = input.eventId ?? newEventId();
  const auditId = newAuditId();
  const correlationId = input.correlationId ?? input.requestId;
  const promptHash = hashTextOrNull(input.promptText);
  const responseHash = hashTextOrNull(input.responseText);
  const status = !resolution.allowed ? "BLOCKED" : (input.status ?? "COMPLETED");
  const occurredAt = input.occurredAt ?? new Date();
  const regions = await resolveEventRegions(input, resolution);

  const lastAudit = await prisma.complianceAuditRecord.findFirst({
    where: { organizationId: input.organizationId },
    orderBy: { createdAt: "desc" },
    select: { integrityHash: true },
  });

  const integrityHash = computeIntegrityHash({
    auditId,
    eventId,
    requestId: input.requestId,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId ?? null,
    provider: input.provider,
    model: input.model,
    riskCategory: resolution.risk,
    reviewMode: resolution.reviewMode,
    reviewStatus: "PENDING",
    promptHash,
    responseHash,
    estimatedCost: input.estimatedCost ?? null,
    actualCost: input.actualCost ?? null,
    policyVersion: resolution.policyVersion,
    disclaimerVersion: resolution.disclaimerVersion,
    createdAt: occurredAt,
    previousIntegrityHash: lastAudit?.integrityHash ?? null,
  });

  const requiresReview = resolution.reviewMode === "REQUIRED" || resolution.reviewMode === "MANDATORY";
  const caseId = requiresReview ? newCaseId() : null;

  const result = await prisma.$transaction(async (tx) => {
    await tx.aIEvent.create({
      data: {
        eventId,
        requestId: input.requestId,
        correlationId,
        idempotencyKey: input.idempotencyKey ?? null,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId ?? null,
        userId: input.userId ?? null,
        apiKeyId: input.apiKeyId ?? null,
        projectId: input.projectId ?? null,
        parentEventId: input.parentEventId ?? null,
        workflowRunId: input.workflowRunId ?? null,
        agentRunId: input.agentRunId ?? null,
        stepId: input.stepId ?? null,

        provider: input.provider,
        model: input.model,
        modelVersion: input.modelVersion ?? "",
        requestedModel: input.requestedModel ?? null,
        resolvedModel: input.resolvedModel ?? null,
        migrationReason: input.migrationReason ?? null,
        migrationPolicyId: input.migrationPolicyId ?? null,
        registryEntryId: input.registryEntryId ?? null,
        priceVersionId: input.priceVersionId ?? null,
        costProfileId: input.costProfileId ?? null,

        taskType: input.taskType ?? "CHAT",
        requestType: input.requestType ?? "chat",
        eventSource: input.eventSource ?? "API",
        environment: input.environment ?? "PRODUCTION",

        inputTokens: input.inputTokens ?? 0,
        outputTokens: input.outputTokens ?? 0,
        cacheReadTokens: input.cacheReadTokens ?? 0,
        cacheWriteTokens: input.cacheWriteTokens ?? 0,
        toolCallCount: input.toolCallCount ?? 0,
        retryCount: input.retryCount ?? 0,
        latencyMs: input.latencyMs ?? null,

        status,
        errorCode: input.errorCode ?? null,
        errorCategory: input.errorCategory ?? null,

        inferenceRegion: regions.inferenceRegion,
        processingRegion: regions.processingRegion,
        dataResidencyRegion: regions.dataResidencyRegion,
        providerRegion: regions.providerRegion,

        generatedByAI: true,
        generatedContentFlag: resolution.policy.requireGeneratedContentFlag,
        humanAssisted: input.humanAssisted ?? false,

        riskCategory: resolution.risk,
        transparencyLevel: resolution.transparency,
        reviewStatus: "PENDING",
        reviewMode: resolution.reviewMode,

        promptHash,
        responseHash,

        usageLogId: input.usageLogId ?? null,
        costCalculationId: input.costCalculationId ?? null,
        billingTransactionId: input.billingTransactionId ?? null,

        policyVersion: resolution.policyVersion,
        disclaimerVersion: resolution.disclaimerVersion,

        estimatedCost: input.estimatedCost ?? null,
        actualCost: input.actualCost ?? null,
        grossMargin: input.grossMargin ?? null,
        currency: input.currency ?? "EUR",

        occurredAt,
        completedAt: input.completedAt ?? (status === "COMPLETED" ? occurredAt : null),
      },
    });

    await tx.complianceAuditRecord.create({
      data: {
        auditId,
        eventId,
        requestId: input.requestId,
        correlationId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId ?? null,
        userId: input.userId ?? null,
        apiKeyId: input.apiKeyId ?? null,
        provider: input.provider,
        model: input.model,
        modelVersion: input.modelVersion ?? "",
        registryEntryId: input.registryEntryId ?? null,
        priceVersionId: input.priceVersionId ?? null,
        costProfileId: input.costProfileId ?? null,
        promptHash,
        responseHash,
        processingRegion: regions.processingRegion,
        inferenceRegion: regions.inferenceRegion,
        dataResidencyRegion: regions.dataResidencyRegion,
        riskCategory: resolution.risk,
        transparencyLevel: resolution.transparency,
        generatedByAI: true,
        generatedContentFlag: resolution.policy.requireGeneratedContentFlag,
        reviewMode: resolution.reviewMode,
        reviewStatus: "PENDING",
        estimatedCost: input.estimatedCost ?? null,
        actualCost: input.actualCost ?? null,
        grossMargin: input.grossMargin ?? null,
        currency: input.currency ?? "EUR",
        inputTokens: input.inputTokens ?? 0,
        outputTokens: input.outputTokens ?? 0,
        cacheReadTokens: input.cacheReadTokens ?? 0,
        cacheWriteTokens: input.cacheWriteTokens ?? 0,
        toolCallCount: input.toolCallCount ?? 0,
        retryCount: input.retryCount ?? 0,
        latencyMs: input.latencyMs ?? null,
        policyVersion: resolution.policyVersion,
        disclaimerVersion: resolution.disclaimerVersion,
        integrityHash,
        previousIntegrityHash: lastAudit?.integrityHash ?? null,
        sealed: true,
      },
    });

    if (caseId) {
      const reviewCase = await tx.humanReviewCase.create({
        data: {
          caseId,
          eventId,
          auditId,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId ?? null,
          reviewMode: resolution.reviewMode,
          status: "PENDING",
          priority: resolution.risk === "PROHIBITED" || resolution.risk === "HIGH" ? "HIGH" : "NORMAL",
          reason:
            resolution.risk === "PROHIBITED"
              ? "Blocked prohibited AI practice — mandatory compliance review required"
              : `Risk category ${resolution.risk} requires human review per active compliance policy`,
        },
      });
      await tx.humanReviewHistory.create({
        data: {
          reviewCaseId: reviewCase.id,
          fromStatus: "PENDING",
          toStatus: "PENDING",
          note: "Case opened automatically by event-recorder",
        },
      });
    }

    return { eventId, auditId, caseId };
  });

  return {
    eventId: result.eventId,
    auditId: result.auditId,
    riskCategory: resolution.risk,
    reviewStatus: "PENDING",
    reviewMode: resolution.reviewMode,
    reviewCaseId: result.caseId,
    blocked: !resolution.allowed,
    blockReason: resolution.blockReason,
    idempotent: false,
  };
}
