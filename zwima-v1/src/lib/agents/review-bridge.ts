import type { HumanReviewPriority, HumanReviewStatus } from "@prisma/client";
import { recordAIEvent } from "../compliance/event-recorder";
import { createHumanReviewCase, updateHumanReviewStatus } from "../compliance/human-review-service";
import { assertAgentPermission, type AgentContext } from "./auth";
import { AgentServiceError } from "./errors";
import { getAgentDb, newAgentReviewLinkId, type AgentReviewLinkRecord, type AgentRunRecord, type AgentRunStepRecord } from "./types";

export type RequestAgentReviewInput = {
  run: AgentRunRecord;
  step?: AgentRunStepRecord | null;
  reason: string;
  priority?: HumanReviewPriority;
};

export type RequestAgentReviewResult = {
  eventId: string;
  auditId: string;
  reviewCaseId: string;
  link: AgentReviewLinkRecord;
};

/**
 * Bridges an agent run/step into the M6 compliance review pipeline: records
 * an AIEvent (reusing `recordAIEvent` — never re-implemented here), ensures
 * a HumanReviewCase exists for it (creating one directly via
 * `createHumanReviewCase` when the agent's own `reviewRequired` business
 * rule demands review even if the resolved compliance policy did not),
 * and links both back to the run/step via an `AgentReviewLink` row.
 *
 * Idempotent by construction: the same run+step always maps to the same
 * `idempotencyKey`, so calling this twice for the same pending review
 * returns the original event/case instead of creating duplicates.
 */
export async function requestAgentRunReview(
  ctx: AgentContext,
  input: RequestAgentReviewInput,
): Promise<RequestAgentReviewResult> {
  assertAgentPermission(ctx, "read");
  const { run, step, reason, priority } = input;
  const idempotencyKey = `agent-review:${run.runId}:${step?.stepId ?? "run"}`;

  const eventResult = await recordAIEvent({
    requestId: idempotencyKey,
    idempotencyKey,
    organizationId: run.organizationId,
    workspaceId: run.workspaceId ?? null,
    userId: run.userId ?? null,
    agentRunId: run.runId,
    stepId: step?.stepId ?? null,
    provider: "mock",
    model: "mock-agent-review",
    taskType: "OTHER",
    requestType: "agent_review",
    eventSource: "SYSTEM",
    environment: "PREVIEW",
    status: "COMPLETED",
  });

  const db = getAgentDb();

  let reviewCaseId = eventResult.reviewCaseId;
  if (!reviewCaseId) {
    const created = await createHumanReviewCase({
      eventId: eventResult.eventId,
      auditId: eventResult.auditId,
      organizationId: run.organizationId,
      workspaceId: run.workspaceId ?? null,
      reviewMode: "REQUIRED",
      reason,
      priority: priority ?? "NORMAL",
    });
    reviewCaseId = created.caseId;
  }

  const existingLink = await db.agentReviewLink.findFirst({
    where: { runId: run.runId, stepId: step?.stepId ?? null },
  });
  const link =
    existingLink ??
    (await db.agentReviewLink.create({
      data: {
        linkId: newAgentReviewLinkId(),
        runId: run.runId,
        stepId: step?.stepId ?? null,
        eventId: eventResult.eventId,
        reviewCaseId,
        organizationId: run.organizationId,
        status: "PENDING",
      },
    }));

  await db.agentRun.update({
    where: { id: run.id },
    data: { status: "WAITING_REVIEW", reviewCaseId, eventId: run.eventId ?? eventResult.eventId },
  });

  return { eventId: eventResult.eventId, auditId: eventResult.auditId, reviewCaseId, link };
}

export type DecideAgentReviewInput = {
  linkId: string;
  decision: HumanReviewStatus;
  note?: string | null;
};

/**
 * Approves/rejects/waives a pending agent review. Delegates the actual
 * status-transition state machine to the existing
 * `updateHumanReviewStatus` (M6) rather than re-implementing it — this
 * function only mirrors the outcome onto the AgentReviewLink and AgentRun.
 */
export async function decideAgentRunReview(
  ctx: AgentContext,
  input: DecideAgentReviewInput,
): Promise<{ link: AgentReviewLinkRecord; run: AgentRunRecord }> {
  assertAgentPermission(ctx, "admin");
  const db = getAgentDb();

  const link = await db.agentReviewLink.findUnique({ where: { linkId: input.linkId } });
  if (!link) throw new AgentServiceError("NOT_FOUND", "Agent review link not found", 404);

  const run = await db.agentRun.findUnique({ where: { runId: link.runId } });
  if (!run || run.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Agent run not found", 404);
  }

  await updateHumanReviewStatus({
    caseId: link.reviewCaseId,
    toStatus: input.decision,
    actorId: ctx.user.id,
    note: input.note ?? null,
  });

  const updatedLink = await db.agentReviewLink.update({
    where: { id: link.id },
    data: { status: input.decision as AgentReviewLinkRecord["status"] },
  });

  const nextRunStatus =
    input.decision === "REJECTED" ? "FAILED" : input.decision === "PENDING" || input.decision === "IN_REVIEW" ? "WAITING_REVIEW" : "RUNNING";

  const updatedRun = await db.agentRun.update({
    where: { id: run.id },
    data: {
      status: nextRunStatus,
      errorMessage: input.decision === "REJECTED" ? input.note ?? "Rejected during human review" : run.errorMessage,
      completedAt: input.decision === "REJECTED" ? new Date() : run.completedAt,
    },
  });

  return { link: updatedLink, run: updatedRun };
}

export async function getAgentReviewLink(ctx: AgentContext, linkId: string): Promise<AgentReviewLinkRecord> {
  assertAgentPermission(ctx, "read");
  const db = getAgentDb();
  const link = await db.agentReviewLink.findUnique({ where: { linkId } });
  if (!link || link.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Agent review link not found", 404);
  }
  return link;
}

export async function listAgentReviewLinksForRun(
  ctx: AgentContext,
  runId: string,
): Promise<AgentReviewLinkRecord[]> {
  assertAgentPermission(ctx, "read");
  const db = getAgentDb();
  const run = await db.agentRun.findUnique({ where: { runId } });
  if (!run || run.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Agent run not found", 404);
  }
  return db.agentReviewLink.findMany({ where: { runId }, orderBy: { createdAt: "asc" } });
}
