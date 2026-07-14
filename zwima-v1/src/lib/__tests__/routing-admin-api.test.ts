import { describe, expect, it } from "vitest";
import { validateRoutingPolicy } from "../routing/policy-config";

describe("routing-admin-api validation", () => {
  it("policy patch payload validates", () => {
    const result = validateRoutingPolicy({
      optimizationMode: "LOWEST_COST",
      allowFallback: true,
      maxFallbackAttempts: 3,
    });
    expect(result.policy.optimizationMode).toBe("LOWEST_COST");
    expect(result.policy.maxFallbackAttempts).toBe(3);
  });

  it("admin-only contract: no secrets in policy object", () => {
    const result = validateRoutingPolicy({ blockedProviders: ["bad"] });
    expect(JSON.stringify(result.policy)).not.toMatch(/secret|password|apikey/i);
  });
});
