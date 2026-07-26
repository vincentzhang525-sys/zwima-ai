import { describe, expect, it, vi } from "vitest";
import { AgentServiceError } from "@/lib/agents/errors";
import { assertStepLimit, assertToolCallLimit, resolveProviderMode, withTimeout } from "../agent-runner";
import { MAX_AGENT_STEPS, MAX_AGENT_TOOL_CALLS } from "../agent-safety";

describe("assertStepLimit", () => {
  it("allows counts at or under the limit", () => {
    expect(() => assertStepLimit(MAX_AGENT_STEPS)).not.toThrow();
    expect(() => assertStepLimit(1)).not.toThrow();
  });

  it("rejects counts over the limit", () => {
    try {
      assertStepLimit(MAX_AGENT_STEPS + 1);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AgentServiceError);
      expect((err as AgentServiceError).code).toBe("STEP_LIMIT_EXCEEDED");
    }
  });
});

describe("assertToolCallLimit", () => {
  it("allows counts at or under the limit", () => {
    expect(() => assertToolCallLimit(MAX_AGENT_TOOL_CALLS)).not.toThrow();
  });

  it("rejects counts over the limit", () => {
    try {
      assertToolCallLimit(MAX_AGENT_TOOL_CALLS + 1);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AgentServiceError);
      expect((err as AgentServiceError).code).toBe("TOOL_CALL_LIMIT_EXCEEDED");
    }
  });
});

describe("resolveProviderMode — fail-closed live provider gate", () => {
  it("always allows the mock provider", () => {
    expect(resolveProviderMode("mock")).toBe("mock");
    expect(resolveProviderMode(undefined)).toBe("mock");
    expect(resolveProviderMode("")).toBe("mock");
  });

  it("blocks a non-mock provider when isLiveProviderHttpAllowed() is false (Production fail-closed)", () => {
    const isLiveAllowed = vi.fn(() => false);
    try {
      resolveProviderMode("openai", isLiveAllowed);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AgentServiceError);
      expect((err as AgentServiceError).code).toBe("LIVE_PROVIDER_BLOCKED");
      expect((err as AgentServiceError).status).toBe(403);
    }
    expect(isLiveAllowed).toHaveBeenCalled();
  });

  it("allows a non-mock provider only when isLiveProviderHttpAllowed() is true", () => {
    const isLiveAllowed = vi.fn(() => true);
    expect(resolveProviderMode("openai", isLiveAllowed)).toBe("live");
  });
});

describe("withTimeout", () => {
  it("resolves normally when the promise finishes before the timeout", async () => {
    const onTimeout = vi.fn();
    const result = await withTimeout(Promise.resolve("done"), 50, onTimeout);
    expect(result).toBe("done");
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("rejects with RUN_TIMEOUT and invokes onTimeout when the promise is too slow", async () => {
    const onTimeout = vi.fn();
    const slow = new Promise((resolve) => setTimeout(resolve, 200));
    await expect(withTimeout(slow, 20, onTimeout)).rejects.toMatchObject({ code: "RUN_TIMEOUT" });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});
