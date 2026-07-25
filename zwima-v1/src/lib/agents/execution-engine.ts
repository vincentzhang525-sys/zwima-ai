import { recordAIEvent } from "../compliance/event-recorder";
import { assertAgentPermission, type AgentContext } from "./auth";
import { AgentServiceError } from "./errors";
import { estimateMockCost, mockChatCompletion, type MockChatMessage } from "./mock-provider";
import { runMockTool } from "./mock-tools";
import { requestAgentRunReview } from "./review-bridge";
import {
  getAgentDb,
  newAgentRunId,
  newAgentRunStepId,
  type AgentDefinitionRecord,
  type AgentRunRecord,
  type AgentRunStatus,
  type AgentRunStepRecord,
  type AgentRunTokenUsage,
  type AgentStepType,
  type AgentVersionRecord,
} from "./types";

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export const AGENT_RUN_TERMINAL_STATUSES: AgentRunStatus[] = ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"];

const ALLOWED_RUN_TRANSITIONS: Record<AgentRunStatus, AgentRunStatus[]> = {
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["WAITING_TOOL", "WAITING_REVIEW", "COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"],
  WAITING_TOOL: ["RUNNING", "FAILED", "CANCELLED", "TIMED_OUT"],
  WAITING_REVIEW: ["RUNNING", "FAILED", "CANCELLED", "TIMED_OUT"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  TIMED_OUT: [],
};

export function isTerminalRunStatus(status: AgentRunStatus): boolean {
  return AGENT_RUN_TERMINAL_STATUSES.includes(status);
}

export function isLegalRunTransition(from: AgentRunStatus, to: AgentRunStatus): boolean {
  if (from === to) return true;
  return ALLOWED_RUN_TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidRunTransitionError extends AgentServiceError {
  constructor(from: AgentRunStatus, to: AgentRunStatus) {
    super("CONFLICT", `Illegal agent run transition: ${from} -> ${to}`, 409);
  }
}

async function transitionRun(
  db: ReturnType<typeof getAgentDb>,
  run: AgentRunRecord,
  toStatus: AgentRunStatus,
  extra: Record<string, unknown> = {},
): Promise<AgentRunRecord> {
  if (!isLegalRunTransition(run.status, toStatus)) {
    throw new InvalidRunTransitionError(run.status, toStatus);
  }
  return db.agentRun.update({ where: { id: run.id }, data: { status: toStatus, ...extra } });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export type CreateRunInput = {
  agentId: string;
  input: Record<string, unknown>;
  workspaceId?: string | null;
  idempotencyKey?: string | null;
  parentRunId?: string | null;
};

async function loadActiveAgentAndVersion(
  ctx: AgentContext,
  agentId: string,
): Promise<{ agent: AgentDefinitionRecord; version: AgentVersionRecord }> {
  const db = getAgentDb();
  const agent = await db.agentDefinition.findUnique({ where: { agentId } });
  if (!agent || agent.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Agent not found", 404);
  }
  if (agent.status !== "ACTIVE" || !agent.currentVersionId) {
    throw new AgentServiceError("CONFLICT", "Agent has no published/active version to run", 409);
  }
  const version = await db.agentVersion.findUnique({ where: { versionId: agent.currentVersionId } });
  if (!version || version.status !== "ACTIVE") {
    throw new AgentServiceError("CONFLICT", "Agent's current version is not ACTIVE", 409);
  }
  return { agent, version };
}

async function nextStepSequence(db: ReturnType<typeof getAgentDb>, runId: string): Promise<number> {
  const last = await db.agentRunStep.findFirst({ where: { runId }, orderBy: { sequence: "desc" } });
  return (last?.sequence ?? 0) + 1;
}

async function createStep(
  db: ReturnType<typeof getAgentDb>,
  runId: string,
  stepType: AgentStepType,
  input: Record<string, unknown> | null,
): Promise<AgentRunStepRecord> {
  const sequence = await nextStepSequence(db, runId);
  return db.agentRunStep.create({
    data: {
      stepId: newAgentRunStepId(),
      runId,
      stepType,
      sequence,
      status: "RUNNING",
      input,
      output: null,
      toolExecutionId: null,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: null,
    },
  });
}

async function completeStep(
  db: ReturnType<typeof getAgentDb>,
  step: AgentRunStepRecord,
  output: Record<string, unknown> | null,
): Promise<AgentRunStepRecord> {
  return db.agentRunStep.update({
    where: { id: step.id },
    data: { status: "COMPLETED", output, completedAt: new Date() },
  });
}

async function failStep(
  db: ReturnType<typeof getAgentDb>,
  step: AgentRunStepRecord,
  errorMessage: string,
): Promise<AgentRunStepRecord> {
  return db.agentRunStep.update({
    where: { id: step.id },
    data: { status: "FAILED", errorMessage, completedAt: new Date() },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asTokenUsage(value: unknown): AgentRunTokenUsage {
  const rec = asRecord(value);
  return {
    inputTokens: Number(rec.inputTokens ?? 0),
    outputTokens: Number(rec.outputTokens ?? 0),
  };
}

function extractMessages(input: unknown): MockChatMessage[] {
  const rec = asRecord(input);
  const rawMessages = rec.messages;
  if (Array.isArray(rawMessages)) {
    return rawMessages
      .filter((m): m is { role: string; content: string } => typeof m === "object" && m !== null && "content" in m)
      .map((m) => ({
        role: (m as { role?: string }).role === "assistant" || (m as { role?: string }).role === "system" || (m as { role?: string }).role === "tool"
          ? (m as { role: MockChatMessage["role"] }).role
          : "user",
        content: String((m as { content: unknown }).content ?? ""),
      }));
  }
  if (typeof rec.message === "string") return [{ role: "user", content: rec.message }];
  if (typeof rec.prompt === "string") return [{ role: "user", content: rec.prompt }];
  return [];
}

function findReviewStep(steps: AgentRunStepRecord[]): AgentRunStepRecord | undefined {
  return steps.find((s) => s.stepType === "REVIEW");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Creates a QUEUED run. Enforces the target version's delegation depth cap when `parentRunId` is set. */
export async function createRun(ctx: AgentContext, input: CreateRunInput): Promise<AgentRunRecord> {
  assertAgentPermission(ctx, "edit");
  const db = getAgentDb();

  if (input.idempotencyKey) {
    const existing = await db.agentRun.findFirst({
      where: { organizationId: ctx.organizationId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }

  const { agent, version } = await loadActiveAgentAndVersion(ctx, input.agentId);

  let depth = 0;
  let rootRunId: string | null = null;
  if (input.parentRunId) {
    const parent = await db.agentRun.findUnique({ where: { runId: input.parentRunId } });
    if (!parent || parent.organizationId !== ctx.organizationId) {
      throw new AgentServiceError("NOT_FOUND", "Parent run not found", 404);
    }
    depth = parent.depth + 1;
    rootRunId = parent.rootRunId ?? parent.runId;
    if (depth > version.maxDelegationDepth) {
      throw new AgentServiceError(
        "VALIDATION_ERROR",
        `Delegation depth ${depth} exceeds agent's maxDelegationDepth (${version.maxDelegationDepth})`,
        400,
      );
    }
  }

  const runId = newAgentRunId();
  const run = await db.agentRun.create({
    data: {
      runId,
      agentId: agent.agentId,
      agentVersionId: version.versionId,
      organizationId: ctx.organizationId,
      workspaceId: input.workspaceId ?? agent.workspaceId ?? null,
      userId: ctx.user.id,
      status: "QUEUED",
      input: input.input ?? {},
      output: null,
      idempotencyKey: input.idempotencyKey ?? null,
      parentRunId: input.parentRunId ?? null,
      rootRunId,
      depth,
      costEstimate: null,
      costActual: null,
      grossMargin: null,
      priceVersionId: null,
      costCalculationId: null,
      requestedModel: version.model,
      resolvedModel: version.model,
      modelVersion: version.versionId,
      migrationReason: null,
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
      latencyMs: null,
      errorMessage: null,
      errorClass: null,
      eventId: null,
      reviewCaseId: null,
      retryOfRunId: null,
      processingRegion: asRecord(version.config).processingRegion
        ? String(asRecord(version.config).processingRegion)
        : "EU",
      compliancePolicyVersion: null,
      startedAt: null,
      completedAt: null,
    },
  });

  return run;
}

export async function getRun(ctx: AgentContext, runId: string): Promise<AgentRunRecord> {
  assertAgentPermission(ctx, "read");
  const db = getAgentDb();
  const run = await db.agentRun.findUnique({ where: { runId } });
  if (!run || run.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Agent run not found", 404);
  }
  return run;
}

export async function listRuns(
  ctx: AgentContext,
  params: { agentId?: string; status?: AgentRunStatus; limit?: number } = {},
): Promise<AgentRunRecord[]> {
  assertAgentPermission(ctx, "read");
  const db = getAgentDb();
  return db.agentRun.findMany({
    where: { organizationId: ctx.organizationId, agentId: params.agentId, status: params.status },
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limit ?? 50, 200),
  });
}

export async function listRunSteps(ctx: AgentContext, runId: string): Promise<AgentRunStepRecord[]> {
  const run = await getRun(ctx, runId);
  const db = getAgentDb();
  return db.agentRunStep.findMany({ where: { runId: run.runId }, orderBy: { sequence: "asc" } });
}

/**
 * Advances a run through the mock execution loop: PLAN -> MODEL -> (optional
 * TOOL) -> (optional REVIEW, pausing to WAITING_REVIEW) -> COMPLETED. Safe to
 * call again on a run left in RUNNING/QUEUED (e.g. after an approved
 * review); it will not re-request review once an approved REVIEW step
 * already exists for the run.
 */
export async function executeRun(ctx: AgentContext, runId: string): Promise<AgentRunRecord> {
  assertAgentPermission(ctx, "edit");
  const db = getAgentDb();

  let run = await getRun(ctx, runId);
  if (isTerminalRunStatus(run.status)) {
    throw new AgentServiceError("CONFLICT", `Run ${runId} is already terminal (${run.status})`, 409);
  }
  if (run.status === "WAITING_REVIEW" || run.status === "WAITING_TOOL") {
    throw new AgentServiceError(
      "CONFLICT",
      `Run ${runId} is ${run.status} — resolve it via the appropriate bridge before resuming execution`,
      409,
    );
  }

  const version = await db.agentVersion.findUnique({ where: { versionId: run.agentVersionId } });
  if (!version) throw new AgentServiceError("NOT_FOUND", "Agent version for this run no longer exists", 404);

  if (run.status === "QUEUED") {
    run = await transitionRun(db, run, "RUNNING", { startedAt: run.startedAt ?? new Date() });
  }

  try {
    const existingSteps = await db.agentRunStep.findMany({ where: { runId: run.runId }, orderBy: { sequence: "asc" } });

    // PLAN
    if (!existingSteps.some((s) => s.stepType === "PLAN")) {
      const planStep = await createStep(db, run.runId, "PLAN", { input: run.input });
      await completeStep(db, planStep, { plan: "Single-turn mock completion; optional tool call; optional human review." });
    }

    // MODEL
    const modelStepAlready = existingSteps.find((s) => s.stepType === "MODEL" && s.status === "COMPLETED");
    let modelOutputText = "";
    let tokenUsage: AgentRunTokenUsage = asTokenUsage(run.tokenUsage);
    if (!modelStepAlready) {
      const modelStep = await createStep(db, run.runId, "MODEL", { systemPrompt: version.systemPrompt });
      const messages = extractMessages(run.input);
      const completion = await mockChatCompletion({
        model: version.model,
        systemPrompt: version.systemPrompt,
        messages,
        temperature: version.temperature,
        maxTokens: version.maxTokens,
        seed: run.runId,
      });
      modelOutputText = completion.text;
      tokenUsage = { inputTokens: completion.inputTokens, outputTokens: completion.outputTokens };
      await completeStep(db, modelStep, { text: completion.text, finishReason: completion.finishReason });

      const modelEventIdempotencyKey = `agent-run:${run.runId}:model-call`;
      const eventResult = await recordAIEvent({
        requestId: modelEventIdempotencyKey,
        idempotencyKey: modelEventIdempotencyKey,
        organizationId: run.organizationId,
        workspaceId: run.workspaceId ?? null,
        userId: run.userId ?? null,
        agentRunId: run.runId,
        stepId: modelStep.stepId,
        provider: "mock",
        model: version.model,
        taskType: "CHAT",
        requestType: "agent_model_call",
        eventSource: "SYSTEM",
        environment: "PREVIEW",
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        status: "COMPLETED",
        estimatedCost: estimateMockCost(completion.inputTokens, completion.outputTokens),
      });

      run = await db.agentRun.update({
        where: { id: run.id },
        data: {
          tokenUsage,
          costEstimate: estimateMockCost(tokenUsage.inputTokens, tokenUsage.outputTokens),
          costActual: estimateMockCost(tokenUsage.inputTokens, tokenUsage.outputTokens),
          grossMargin: 0,
          requestedModel: version.model,
          resolvedModel: version.model,
          modelVersion: version.versionId,
          priceVersionId: "mock-price-v1",
          costCalculationId: `mock-cost-${run.runId}`,
          eventId: run.eventId ?? eventResult.eventId,
        },
      });
    } else {
      modelOutputText = asRecord(modelStepAlready.output).text
        ? String(asRecord(modelStepAlready.output).text)
        : "";
    }

    // Optional TOOL step, triggered by `input.useTool: { toolKey, args }`
    const inputRec = asRecord(run.input);
    const toolRequest = inputRec.useTool as { toolKey?: string; args?: Record<string, unknown> } | undefined;
    if (toolRequest?.toolKey && !existingSteps.some((s) => s.stepType === "TOOL" && s.status === "COMPLETED")) {
      const toolStep = await createStep(db, run.runId, "TOOL", { toolKey: toolRequest.toolKey, args: toolRequest.args ?? {} });
      run = await transitionRun(db, run, "WAITING_TOOL");
      const toolDef = await db.toolDefinition.findFirst({
        where: {
          key: toolRequest.toolKey,
          OR: [{ organizationId: run.organizationId }, { organizationId: null }],
        },
      });
      const started = Date.now();
      try {
        const toolOutput = await runMockTool(toolRequest.toolKey, toolRequest.args ?? {});
        if (toolDef?.currentVersionId) {
          const execution = await db.toolExecution.create({
            data: {
              executionId: `exe_${run.runId}_${toolStep.sequence}`,
              runId: run.runId,
              stepId: toolStep.stepId,
              toolId: toolDef.toolId,
              toolVersionId: toolDef.currentVersionId,
              organizationId: run.organizationId,
              input: toolRequest.args ?? {},
              output: toolOutput,
              status: "SUCCESS",
              errorMessage: null,
              latencyMs: Date.now() - started,
            },
          });
          await db.agentRunStep.update({
            where: { id: toolStep.id },
            data: { toolExecutionId: execution.executionId },
          });
        }
        await completeStep(db, toolStep, toolOutput);
        run = await transitionRun(db, run, "RUNNING");
      } catch (toolErr) {
        if (toolDef?.currentVersionId) {
          await db.toolExecution.create({
            data: {
              executionId: `exe_${run.runId}_${toolStep.sequence}_fail`,
              runId: run.runId,
              stepId: toolStep.stepId,
              toolId: toolDef.toolId,
              toolVersionId: toolDef.currentVersionId,
              organizationId: run.organizationId,
              input: toolRequest.args ?? {},
              output: null,
              status: "FAILED",
              errorMessage: toolErr instanceof Error ? toolErr.message : "Tool execution failed",
              latencyMs: Date.now() - started,
            },
          });
        }
        await failStep(db, toolStep, toolErr instanceof Error ? toolErr.message : "Tool execution failed");
        throw toolErr;
      }
    }

    // Optional REVIEW gate. A REVIEW step is only ever created once per run: if it doesn't
    // exist yet and the version requires review, create it and pause (WAITING_REVIEW). If it
    // already exists and we got this far, it means `decideAgentRunReview` approved/waived it and
    // put the run back to RUNNING — so we mark the step COMPLETED and continue to finalization.
    const refreshedSteps = await db.agentRunStep.findMany({ where: { runId: run.runId }, orderBy: { sequence: "asc" } });
    const existingReviewStep = findReviewStep(refreshedSteps);

    if (version.reviewRequired && !existingReviewStep) {
      const reviewStep = await createStep(db, run.runId, "REVIEW", { reason: "Agent version requires human review before completion" });
      await requestAgentRunReview(ctx, {
        run,
        step: reviewStep,
        reason: "Agent version configuration requires human review before this run can complete",
      });
      // requestAgentRunReview already transitions the run to WAITING_REVIEW; the REVIEW step
      // stays RUNNING until an approval decision completes it (see `decideAgentRunReview`).
      const waiting = await db.agentRun.findUnique({ where: { id: run.id } });
      if (!waiting) throw new AgentServiceError("NOT_FOUND", "Agent run disappeared mid-execution", 404);
      return waiting;
    }
    if (existingReviewStep && existingReviewStep.status === "RUNNING") {
      await completeStep(db, existingReviewStep, { decision: "APPROVED_OR_WAIVED" });
    }

    const finalRun = await transitionRun(db, run, "COMPLETED", {
      output: { text: modelOutputText },
      completedAt: new Date(),
    });
    return finalRun;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent run failed";
    const failed = await db.agentRun.findUnique({ where: { id: run.id } });
    if (failed && !isTerminalRunStatus(failed.status)) {
      await transitionRun(db, failed, "FAILED", { errorMessage: message, completedAt: new Date() });
    }
    if (err instanceof AgentServiceError) throw err;
    throw new AgentServiceError("INTERNAL_ERROR", message, 500);
  }
}

export async function cancelRun(ctx: AgentContext, runId: string, reason?: string): Promise<AgentRunRecord> {
  assertAgentPermission(ctx, "edit");
  const db = getAgentDb();
  const run = await getRun(ctx, runId);
  if (isTerminalRunStatus(run.status)) {
    throw new AgentServiceError("CONFLICT", `Run ${runId} is already terminal (${run.status})`, 409);
  }
  return transitionRun(db, run, "CANCELLED", {
    errorMessage: reason ?? "Cancelled by user",
    completedAt: new Date(),
  });
}

/** Creates a fresh run cloning the failed/cancelled/timed-out run's input, preserving the original for audit purposes. */
export async function retryRun(
  ctx: AgentContext,
  runId: string,
  options: { idempotencyKey?: string } = {},
): Promise<AgentRunRecord> {
  assertAgentPermission(ctx, "edit");
  const original = await getRun(ctx, runId);
  if (!["FAILED", "CANCELLED", "TIMED_OUT"].includes(original.status)) {
    throw new AgentServiceError("CONFLICT", `Only a FAILED/CANCELLED/TIMED_OUT run can be retried (current: ${original.status})`, 409);
  }

  const db = getAgentDb();
  const retryRunId = newAgentRunId();
  return db.agentRun.create({
    data: {
      runId: retryRunId,
      agentId: original.agentId,
      agentVersionId: original.agentVersionId,
      organizationId: original.organizationId,
      workspaceId: original.workspaceId,
      userId: ctx.user.id,
      status: "QUEUED",
      input: original.input,
      output: null,
      idempotencyKey: options.idempotencyKey ?? null,
      parentRunId: original.parentRunId,
      rootRunId: original.rootRunId,
      depth: original.depth,
      costEstimate: null,
      costActual: null,
      grossMargin: null,
      priceVersionId: null,
      costCalculationId: null,
      requestedModel: original.requestedModel,
      resolvedModel: original.resolvedModel,
      modelVersion: original.modelVersion,
      migrationReason: null,
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
      latencyMs: null,
      errorMessage: null,
      errorClass: null,
      eventId: null,
      reviewCaseId: null,
      retryOfRunId: original.runId,
      processingRegion: original.processingRegion,
      compliancePolicyVersion: null,
      startedAt: null,
      completedAt: null,
    },
  });
}
