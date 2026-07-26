import { describe, expect, it } from "vitest";
import { AgentServiceError } from "@/lib/agents/errors";
import { assertWithinCostCeiling, estimateRunCost, projectWorstCaseCost } from "../agent-cost-tracker";
import { PER_RUN_COST_CEILING_USD } from "../agent-safety";

describe("estimateRunCost", () => {
  it("is deterministic and non-negative for typical mock usage", () => {
    const cost = estimateRunCost({ inputTokens: 100, outputTokens: 200 });
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBe(estimateRunCost({ inputTokens: 100, outputTokens: 200 }));
  });

  it("is effectively free for typical mock-sized runs (well under the ceiling)", () => {
    const cost = estimateRunCost({ inputTokens: 500, outputTokens: 500 });
    expect(cost).toBeLessThan(PER_RUN_COST_CEILING_USD);
  });
});

describe("projectWorstCaseCost", () => {
  it("clamps the projected output tokens to the safety max", () => {
    const cost = projectWorstCaseCost(100, 999_999_999);
    expect(cost).toBeLessThan(1); // clamp keeps this tiny even for an absurd maxTokens request
  });
});

describe("assertWithinCostCeiling", () => {
  it("does not throw when under the ceiling", () => {
    expect(() => assertWithinCostCeiling(0.01, "test")).not.toThrow();
  });

  it("throws AgentServiceError(COST_CEILING_EXCEEDED) when over the ceiling", () => {
    try {
      assertWithinCostCeiling(PER_RUN_COST_CEILING_USD + 1, "test run");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AgentServiceError);
      expect((err as AgentServiceError).code).toBe("COST_CEILING_EXCEEDED");
      expect((err as AgentServiceError).status).toBe(402);
    }
  });
});
