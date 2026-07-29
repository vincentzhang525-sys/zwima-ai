import { afterEach, describe, expect, it } from "vitest";
import {
  RUNTIME_ALLOWED_TRANSITIONS,
  assertLegalRuntimeTransition,
  isLegalRuntimeTransition,
  evaluateRuntimeSafetyGate,
  runMockExecutor,
  runAgent,
  clearRuntimeIdempotencyStoreForTests,
  formatRuntimeLogLine,
  Gap020RunRequestSchema,
  summarizeInput,
} from "../runtime";

afterEach(() => {
  clearRuntimeIdempotencyStoreForTests();
});

describe("GAP-020 state machine", () => {
  it("allows the documented happy path", () => {
    expect(isLegalRuntimeTransition("CREATED", "QUEUED")).toBe(true);
    expect(isLegalRuntimeTransition("QUEUED", "RUNNING")).toBe(true);
    expect(isLegalRuntimeTransition("RUNNING", "COMPLETED")).toBe(true);
  });

  it("allows CREATED -> BLOCKED_BY_SAFETY_GATE", () => {
    expect(isLegalRuntimeTransition("CREATED", "BLOCKED_BY_SAFETY_GATE")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(isLegalRuntimeTransition("COMPLETED", "RUNNING")).toBe(false);
    expect(isLegalRuntimeTransition("FAILED", "QUEUED")).toBe(false);
    expect(isLegalRuntimeTransition("BLOCKED_BY_SAFETY_GATE", "RUNNING")).toBe(false);
    expect(isLegalRuntimeTransition("CREATED", "COMPLETED")).toBe(false);
    expect(() => assertLegalRuntimeTransition("RUNNING", "QUEUED")).toThrow(/Illegal runtime transition/);
  });

  it("declares terminal statuses with empty outbound edges", () => {
    for (const status of ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT", "BLOCKED_BY_SAFETY_GATE"] as const) {
      expect(RUNTIME_ALLOWED_TRANSITIONS[status]).toEqual([]);
    }
  });
});

describe("GAP-020 safety gate", () => {
  const base = {
    agentEnabled: true,
    workspaceId: "ws_1",
    userId: "user_1",
    liveProviderAllowed: false,
  };

  it("allows MOCK and PREVIEW_SAFE", () => {
    expect(evaluateRuntimeSafetyGate({ ...base, executionMode: "MOCK" }).allowed).toBe(true);
    expect(evaluateRuntimeSafetyGate({ ...base, executionMode: "PREVIEW_SAFE" }).allowed).toBe(true);
  });

  it("blocks LIVE_PROVIDER without silent downgrade", () => {
    const d = evaluateRuntimeSafetyGate({ ...base, executionMode: "LIVE_PROVIDER" });
    expect(d.allowed).toBe(false);
    expect(d.code).toBe("EXECUTION_MODE_FORBIDDEN");
    expect(d.realProviderCallAllowed).toBe(false);
    expect(d.mockAgentExecutionAllowed).toBe(false);
  });

  it("blocks PRODUCTION_EXECUTION", () => {
    const d = evaluateRuntimeSafetyGate({ ...base, executionMode: "PRODUCTION_EXECUTION" });
    expect(d.allowed).toBe(false);
    expect(d.code).toBe("EXECUTION_MODE_FORBIDDEN");
  });

  it("Preview defaults deny real provider/payment/email/side-effects", () => {
    const d = evaluateRuntimeSafetyGate({ ...base, executionMode: "MOCK" });
    expect(d.realProviderCallAllowed).toBe(false);
    expect(d.realPaymentAllowed).toBe(false);
    expect(d.realEmailAllowed).toBe(false);
    expect(d.externalSideEffectAllowed).toBe(false);
    expect(d.mockAgentExecutionAllowed).toBe(true);
  });

  it("blocks disabled agents", () => {
    const d = evaluateRuntimeSafetyGate({ ...base, executionMode: "MOCK", agentEnabled: false });
    expect(d.allowed).toBe(false);
    expect(d.code).toBe("AGENT_DISABLED");
  });

  it("blocks missing user", () => {
    const d = evaluateRuntimeSafetyGate({ ...base, executionMode: "MOCK", userId: null });
    expect(d.allowed).toBe(false);
    expect(d.code).toBe("UNAUTHORIZED");
  });
});

describe("GAP-020 mock executor", () => {
  it("returns deterministic success without provider calls", async () => {
    const r = await runMockExecutor({
      scenario: "success",
      message: "hello",
      timeoutMs: 1000,
    });
    expect(r.kind).toBe("success");
    if (r.kind === "success") {
      expect(r.output.mock).toBe(true);
      expect(r.output.providerCallExecuted).toBe(false);
      expect(r.output.text).toContain("hello");
    }
  });

  it("supports forced failure", async () => {
    const r = await runMockExecutor({ scenario: "fail", message: "x", timeoutMs: 1000 });
    expect(r.kind).toBe("fail");
    if (r.kind === "fail") expect(r.error.code).toBe("MOCK_FORCED_FAILURE");
  });

  it("supports timeout scenario", async () => {
    const r = await runMockExecutor({ scenario: "timeout", message: "x", timeoutMs: 40 });
    expect(r.kind).toBe("timeout");
  });

  it("supports AbortSignal cancel", async () => {
    const c = new AbortController();
    const p = runMockExecutor({
      scenario: "success",
      message: "x",
      timeoutMs: 5000,
      signal: c.signal,
    });
    c.abort();
    const r = await p;
    expect(r.kind).toBe("cancelled");
  });
});

describe("GAP-020 runAgent service", () => {
  const baseParams = {
    agentId: "agent_1",
    workspaceId: "ws_1",
    userId: "user_1",
    agentEnabled: true,
    agentOrganizationId: "org_1",
    callerOrganizationId: "org_1",
    executionMode: "MOCK",
  };

  it("MOCK success returns contract flags all false for side effects", async () => {
    const r = await runAgent({ ...baseParams, input: { message: "hi" }, scenario: "success" });
    expect(r.status).toBe("COMPLETED");
    expect(r.providerCallExecuted).toBe(false);
    expect(r.paymentCreated).toBe(false);
    expect(r.emailSent).toBe(false);
    expect(r.externalSideEffectExecuted).toBe(false);
    expect(r.runId).toBeTruthy();
    expect(r.safetyDecision.allowed).toBe(true);
  });

  it("MOCK fail / timeout / cancel", async () => {
    const fail = await runAgent({ ...baseParams, scenario: "fail" });
    expect(fail.status).toBe("FAILED");

    const timed = await runAgent({
      ...baseParams,
      scenario: "timeout",
      timeoutMs: 80,
      idempotencyKey: "t1",
    });
    expect(timed.status).toBe("TIMED_OUT");

    const c = new AbortController();
    c.abort();
    const cancelled = await runAgent({
      ...baseParams,
      scenario: "success",
      signal: c.signal,
      idempotencyKey: "c1",
    });
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("forbidden executionMode returns BLOCKED_BY_SAFETY_GATE (no silent downgrade)", async () => {
    const r = await runAgent({
      ...baseParams,
      executionMode: "LIVE_PROVIDER",
      idempotencyKey: "live-1",
    });
    expect(r.status).toBe("BLOCKED_BY_SAFETY_GATE");
    expect(r.error?.code).toBe("EXECUTION_MODE_FORBIDDEN");
    expect(r.providerCallExecuted).toBe(false);
  });

  it("idempotency key does not double-execute", async () => {
    const a = await runAgent({
      ...baseParams,
      scenario: "success",
      idempotencyKey: "idem-same",
      input: { message: "first" },
    });
    const b = await runAgent({
      ...baseParams,
      scenario: "fail",
      idempotencyKey: "idem-same",
      input: { message: "second" },
    });
    expect(b.runId).toBe(a.runId);
    expect(b.status).toBe("COMPLETED");
    expect(b.inputSummary).toBe(a.inputSummary);
  });

  it("agent org mismatch fails closed", async () => {
    const r = await runAgent({
      ...baseParams,
      agentOrganizationId: "org_other",
      callerOrganizationId: "org_1",
      idempotencyKey: "mismatch",
    });
    expect(r.status).toBe("FAILED");
    expect(r.error?.code).toBe("AGENT_NOT_IN_WORKSPACE");
  });
});

describe("GAP-020 API input validation + log safety", () => {
  it("rejects invalid executionMode at schema layer", () => {
    const parsed = Gap020RunRequestSchema.safeParse({
      executionMode: "LIVE_PROVIDER",
      input: { message: "x" },
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts MOCK / PREVIEW_SAFE with bounded input", () => {
    const parsed = Gap020RunRequestSchema.safeParse({
      executionMode: "PREVIEW_SAFE",
      input: { message: "ok" },
      idempotencyKey: "k1",
    });
    expect(parsed.success).toBe(true);
  });

  it("summarizeInput never embeds secrets or connection strings", () => {
    const summary = summarizeInput({
      message: "hello world",
      apiKey: "sk-secret-should-not-dump-full",
      DATABASE_URL: "postgresql://user:pass@host/db",
    });
    expect(summary).toContain("message");
    expect(summary).not.toContain("postgresql://");
    expect(summary).not.toContain("sk-secret-should-not-dump-full");
  });

  it("formatRuntimeLogLine omits raw secrets", async () => {
    const r = await runAgent({
      agentId: "a",
      userId: "u",
      agentEnabled: true,
      executionMode: "MOCK",
      input: { message: "token=sk-live-abcdef", apiKey: "sk-live-abcdef" },
      idempotencyKey: "log-1",
    });
    const line = formatRuntimeLogLine(r);
    expect(line).not.toContain("sk-live-abcdef");
    expect(line).toContain("providerCallExecuted");
    expect(JSON.parse(line).providerCallExecuted).toBe(false);
  });
});
