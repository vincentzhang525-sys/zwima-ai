import { randomUUID } from "crypto";
import { assertLegalRuntimeTransition } from "./state-machine";
import { evaluateRuntimeSafetyGate } from "./safety-gate";
import { runMockExecutor } from "./mock-executor";
import {
  DEFAULT_RUNTIME_TIMEOUT_MS,
  summarizeInput,
  type AgentRuntimeResult,
  type MockScenario,
  type RuntimeStatus,
  type SafetyDecision,
} from "./types";

export type RunAgentParams = {
  agentId: string;
  workspaceId?: string | null;
  userId: string;
  input?: Record<string, unknown>;
  executionMode: string;
  /** Whether the agent lifecycle allows execution (ACTIVE). */
  agentEnabled: boolean;
  agentOrganizationId?: string | null;
  agentWorkspaceId?: string | null;
  callerOrganizationId?: string | null;
  idempotencyKey?: string | null;
  requestId?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
  scenario?: MockScenario;
  liveProviderAllowed?: boolean;
};

/** In-memory idempotency for GAP-020 foundation (also used when DB run is skipped for blocked modes). */
const idempotencyStore = new Map<string, AgentRuntimeResult>();
/** In-flight locks to prevent concurrent double-execution for the same key. */
const inflight = new Map<string, Promise<AgentRuntimeResult>>();

export function clearRuntimeIdempotencyStoreForTests(): void {
  idempotencyStore.clear();
  inflight.clear();
}

function idemKey(params: RunAgentParams): string | null {
  const raw = params.idempotencyKey ?? params.requestId;
  if (!raw?.trim()) return null;
  const org = params.callerOrganizationId ?? "anon";
  return `${org}:${raw.trim()}`;
}

function buildResult(partial: {
  runId: string | null;
  agentId: string;
  workspaceId: string | null;
  status: RuntimeStatus;
  executionMode: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  inputSummary: string;
  output: unknown;
  error: { code: string; message: string } | null;
  safetyDecision: SafetyDecision;
}): AgentRuntimeResult {
  return {
    ...partial,
    providerCallExecuted: false,
    paymentCreated: false,
    emailSent: false,
    externalSideEffectExecuted: false,
  };
}

/**
 * GAP-020 unified Agent Runtime entry.
 * Phase 1: MOCK / PREVIEW_SAFE only — never silent-downgrade forbidden modes.
 */
export async function runAgent(params: RunAgentParams): Promise<AgentRuntimeResult> {
  const key = idemKey(params);
  if (key) {
    const cached = idempotencyStore.get(key);
    if (cached) return cached;
    const pending = inflight.get(key);
    if (pending) return pending;
  }

  const work = executeOnce(params);
  if (key) inflight.set(key, work);
  try {
    const result = await work;
    if (key) idempotencyStore.set(key, result);
    return result;
  } finally {
    if (key) inflight.delete(key);
  }
}

async function executeOnce(params: RunAgentParams): Promise<AgentRuntimeResult> {
  const startedAt = new Date();
  const input = params.input ?? {};
  const inputSummary = summarizeInput(input);
  const timeoutMs = Math.min(
    Math.max(params.timeoutMs ?? DEFAULT_RUNTIME_TIMEOUT_MS, 50),
    30_000,
  );
  const workspaceId = params.workspaceId ?? params.agentWorkspaceId ?? null;

  let status: RuntimeStatus = "CREATED";

  const safetyDecision = evaluateRuntimeSafetyGate({
    executionMode: params.executionMode,
    agentEnabled: params.agentEnabled,
    workspaceId,
    userId: params.userId,
    liveProviderAllowed: params.liveProviderAllowed,
  });

  if (!safetyDecision.allowed) {
    assertLegalRuntimeTransition(status, "BLOCKED_BY_SAFETY_GATE");
    status = "BLOCKED_BY_SAFETY_GATE";
    const finishedAt = new Date();
    return buildResult({
      runId: null,
      agentId: params.agentId,
      workspaceId,
      status,
      executionMode: String(params.executionMode),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      inputSummary,
      output: null,
      error: { code: safetyDecision.code, message: safetyDecision.reason },
      safetyDecision,
    });
  }

  if (
    params.callerOrganizationId &&
    params.agentOrganizationId &&
    params.callerOrganizationId !== params.agentOrganizationId
  ) {
    const finishedAt = new Date();
    return buildResult({
      runId: null,
      agentId: params.agentId,
      workspaceId,
      status: "FAILED",
      executionMode: String(params.executionMode),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      inputSummary,
      output: null,
      error: { code: "AGENT_NOT_IN_WORKSPACE", message: "Agent does not belong to the caller's workspace/organization." },
      safetyDecision: {
        ...safetyDecision,
        allowed: false,
        code: "AGENT_NOT_IN_WORKSPACE",
        reason: "Agent organization mismatch.",
      },
    });
  }

  if (
    params.workspaceId &&
    params.agentWorkspaceId &&
    params.workspaceId !== params.agentWorkspaceId
  ) {
    const finishedAt = new Date();
    return buildResult({
      runId: null,
      agentId: params.agentId,
      workspaceId,
      status: "FAILED",
      executionMode: String(params.executionMode),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      inputSummary,
      output: null,
      error: {
        code: "AGENT_WORKSPACE_MISMATCH",
        message: "Agent does not belong to the requested workspaceId.",
      },
      safetyDecision: {
        ...safetyDecision,
        allowed: false,
        code: "AGENT_WORKSPACE_MISMATCH",
        reason: "workspaceId does not match agent.",
      },
    });
  }

  assertLegalRuntimeTransition(status, "QUEUED");
  status = "QUEUED";
  assertLegalRuntimeTransition(status, "RUNNING");
  status = "RUNNING";

  const scenario: MockScenario =
    params.scenario ??
    (typeof input.scenario === "string" &&
    (input.scenario === "success" || input.scenario === "fail" || input.scenario === "timeout")
      ? input.scenario
      : "success");

  const message =
    typeof input.message === "string"
      ? input.message
      : typeof input.prompt === "string"
        ? input.prompt
        : "Preview-safe mock run";

  const mock = await runMockExecutor({
    scenario,
    message,
    signal: params.signal,
    timeoutMs: scenario === "timeout" ? Math.min(timeoutMs, 100) : timeoutMs,
  });

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const runId = `arun_gap020_${randomUUID().replace(/-/g, "").slice(0, 20)}`;

  if (mock.kind === "success") {
    assertLegalRuntimeTransition(status, "COMPLETED");
    return buildResult({
      runId,
      agentId: params.agentId,
      workspaceId,
      status: "COMPLETED",
      executionMode: String(params.executionMode),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      inputSummary,
      output: mock.output,
      error: null,
      safetyDecision,
    });
  }

  const nextStatus: RuntimeStatus =
    mock.kind === "timeout" ? "TIMED_OUT" : mock.kind === "cancelled" ? "CANCELLED" : "FAILED";
  assertLegalRuntimeTransition(status, nextStatus);
  return buildResult({
    runId,
    agentId: params.agentId,
    workspaceId,
    status: nextStatus,
    executionMode: String(params.executionMode),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    inputSummary,
    output: null,
    error: mock.error,
    safetyDecision,
  });
}

/** Safe log line — never includes raw input, DB URLs, or secrets. */
export function formatRuntimeLogLine(result: AgentRuntimeResult): string {
  return JSON.stringify({
    event: "gap020.runtime.result",
    runId: result.runId,
    agentId: result.agentId,
    workspaceId: result.workspaceId,
    status: result.status,
    executionMode: result.executionMode,
    durationMs: result.durationMs,
    inputSummary: result.inputSummary,
    errorCode: result.error?.code ?? null,
    safetyCode: result.safetyDecision.code,
    providerCallExecuted: result.providerCallExecuted,
    paymentCreated: result.paymentCreated,
    emailSent: result.emailSent,
    externalSideEffectExecuted: result.externalSideEffectExecuted,
  });
}
