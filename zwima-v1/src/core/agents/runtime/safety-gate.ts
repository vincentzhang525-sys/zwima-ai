import { isLiveProviderHttpAllowed } from "@/lib/providers/live-provider-gate";
import type { ExecutionMode, ForbiddenExecutionMode, SafetyDecision } from "./types";
import { FORBIDDEN_EXECUTION_MODES } from "./types";

export type SafetyGateInput = {
  executionMode: string;
  environment?: string;
  agentEnabled: boolean;
  workspaceId: string | null | undefined;
  userId: string | null | undefined;
  /** Injected for tests — defaults to live-provider gate. */
  liveProviderAllowed?: boolean;
};

function previewDefaults(liveProviderAllowed: boolean): Omit<SafetyDecision, "allowed" | "code" | "reason"> {
  return {
    realProviderCallAllowed: liveProviderAllowed,
    realPaymentAllowed: false,
    realEmailAllowed: false,
    externalSideEffectAllowed: false,
    mockAgentExecutionAllowed: true,
  };
}

/**
 * Preview-safe runtime safety gate.
 * Forbidden modes must return an explicit block — never silent downgrade.
 */
export function evaluateRuntimeSafetyGate(input: SafetyGateInput): SafetyDecision {
  const liveProviderAllowed =
    input.liveProviderAllowed ?? isLiveProviderHttpAllowed();
  const defaults = previewDefaults(liveProviderAllowed);

  if (!input.userId) {
    return {
      ...defaults,
      allowed: false,
      code: "UNAUTHORIZED",
      reason: "Authenticated user is required.",
    };
  }

  const mode = String(input.executionMode || "").trim().toUpperCase();
  if ((FORBIDDEN_EXECUTION_MODES as readonly string[]).includes(mode)) {
    return {
      ...defaults,
      allowed: false,
      code: "EXECUTION_MODE_FORBIDDEN",
      reason: `executionMode '${mode}' is forbidden in GAP-020 Phase 1. Allowed: MOCK, PREVIEW_SAFE.`,
      mockAgentExecutionAllowed: false,
    };
  }

  if (mode !== "MOCK" && mode !== "PREVIEW_SAFE") {
    return {
      ...defaults,
      allowed: false,
      code: "EXECUTION_MODE_INVALID",
      reason: `Unknown executionMode '${mode}'. Allowed: MOCK, PREVIEW_SAFE.`,
      mockAgentExecutionAllowed: false,
    };
  }

  if (!input.agentEnabled) {
    return {
      ...defaults,
      allowed: false,
      code: "AGENT_DISABLED",
      reason: "Agent is not enabled (ACTIVE) for execution.",
    };
  }

  // PREVIEW_SAFE still forbids real provider/payment/email/side effects.
  if (mode === "PREVIEW_SAFE" && liveProviderAllowed) {
    // Even if live gate is open in Production, GAP-020 Phase 1 API never enables live calls.
    return {
      ...defaults,
      allowed: true,
      code: "ALLOW_PREVIEW_SAFE_MOCK_ONLY",
      reason: "PREVIEW_SAFE allowed; real Provider/payment/email/side-effects remain denied.",
      realProviderCallAllowed: false,
    };
  }

  return {
    ...defaults,
    allowed: true,
    code: "ALLOW_MOCK",
    reason: `${mode as ExecutionMode} execution allowed under Preview-safe foundation rules.`,
    realProviderCallAllowed: false,
  };
}

export function isForbiddenExecutionMode(mode: string): mode is ForbiddenExecutionMode {
  return (FORBIDDEN_EXECUTION_MODES as readonly string[]).includes(mode.trim().toUpperCase());
}
