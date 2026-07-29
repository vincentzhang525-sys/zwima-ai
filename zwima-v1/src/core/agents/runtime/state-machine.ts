import type { RuntimeStatus } from "./types";

/**
 * GAP-020 runtime state machine.
 * BLOCKED_BY_SAFETY_GATE is terminal and only reachable from CREATED
 * (pre-persist gate rejection). CREATED is ephemeral before QUEUED.
 */
export const RUNTIME_ALLOWED_TRANSITIONS: Record<RuntimeStatus, RuntimeStatus[]> = {
  CREATED: ["QUEUED", "BLOCKED_BY_SAFETY_GATE", "CANCELLED"],
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  TIMED_OUT: [],
  BLOCKED_BY_SAFETY_GATE: [],
};

export function isLegalRuntimeTransition(from: RuntimeStatus, to: RuntimeStatus): boolean {
  return RUNTIME_ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertLegalRuntimeTransition(from: RuntimeStatus, to: RuntimeStatus): void {
  if (!isLegalRuntimeTransition(from, to)) {
    throw new Error(`Illegal runtime transition: ${from} -> ${to}`);
  }
}

export function isTerminalRuntimeStatus(status: RuntimeStatus): boolean {
  return RUNTIME_ALLOWED_TRANSITIONS[status]?.length === 0;
}
