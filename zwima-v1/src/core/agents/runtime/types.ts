import { z } from "zod";

/** GAP-020 Phase 1 execution modes — LIVE/PRODUCTION forbidden. */
export const EXECUTION_MODES = ["MOCK", "PREVIEW_SAFE"] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const FORBIDDEN_EXECUTION_MODES = ["LIVE_PROVIDER", "PRODUCTION_EXECUTION"] as const;
export type ForbiddenExecutionMode = (typeof FORBIDDEN_EXECUTION_MODES)[number];

/** Runtime status contract (includes statuses not yet in Prisma enum). */
export const RUNTIME_STATUSES = [
  "CREATED",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
  "BLOCKED_BY_SAFETY_GATE",
] as const;
export type RuntimeStatus = (typeof RUNTIME_STATUSES)[number];

export const MOCK_SCENARIOS = ["success", "fail", "timeout"] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export type SafetyDecision = {
  allowed: boolean;
  code: string;
  reason: string;
  realProviderCallAllowed: boolean;
  realPaymentAllowed: boolean;
  realEmailAllowed: boolean;
  externalSideEffectAllowed: boolean;
  mockAgentExecutionAllowed: boolean;
};

export type AgentRuntimeResult = {
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
  providerCallExecuted: boolean;
  paymentCreated: boolean;
  emailSent: boolean;
  externalSideEffectExecuted: boolean;
};

export const Gap020RunRequestSchema = z.object({
  input: z
    .record(z.string(), z.unknown())
    .refine((obj) => JSON.stringify(obj).length <= 20_000, {
      message: "input payload too large (max 20000 chars serialized)",
    })
    .default({}),
  executionMode: z.enum(["MOCK", "PREVIEW_SAFE"]).default("MOCK"),
  workspaceId: z.string().trim().min(1).max(200).nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(200).nullable().optional(),
  /** Deterministic mock scenario for foundation tests. */
  scenario: z.enum(["success", "fail", "timeout"]).optional(),
  /** Optional override timeout ms for mock executor (capped by service). */
  timeoutMs: z.number().int().min(50).max(30_000).optional(),
});

export type Gap020RunRequest = z.infer<typeof Gap020RunRequestSchema>;

export const DEFAULT_RUNTIME_TIMEOUT_MS = 15_000;
export const MOCK_TIMEOUT_SCENARIO_MS = 50;

const SECRETISH =
  /(sk-[a-zA-Z0-9_-]+|api[_-]?key|bearer\s+\S+|postgresql:\/\/\S+|mysql:\/\/\S+|mongodb(\+srv)?:\/\/\S+|password\s*=\s*\S+)/gi;

function redactPreview(text: string): string {
  return text.replace(SECRETISH, "[REDACTED]").slice(0, 80);
}

/** Redacted input summary for logs/API — never full payload or secrets. */
export function summarizeInput(input: Record<string, unknown>): string {
  const keys = Object.keys(input)
    .filter((k) => !/secret|password|token|api[_-]?key|authorization|database|connection/i.test(k))
    .slice(0, 8);
  const rawMessage =
    typeof input.message === "string"
      ? input.message
      : typeof input.prompt === "string"
        ? input.prompt
        : null;
  const message = rawMessage ? redactPreview(rawMessage) : null;
  return JSON.stringify({
    keys,
    messagePreview: message ? `${message}${rawMessage && rawMessage.length >= 80 ? "…" : ""}` : null,
    scenario: typeof input.scenario === "string" ? input.scenario : null,
  });
}
