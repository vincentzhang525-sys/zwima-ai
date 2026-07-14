import { describe, expect, it } from "vitest";
import { DEFAULT_ROUTING_POLICY, mergeRoutingPolicies, validateRoutingPolicy } from "../routing/policy-config";

describe("routing-policy", () => {
  it("invalid optimizationMode falls back", () => {
    const { policy, valid } = validateRoutingPolicy({ optimizationMode: "NOPE" });
    expect(valid).toBe(false);
    expect(policy.optimizationMode).toBe("BALANCED");
  });

  it("merge priority api key wins", () => {
    const p = mergeRoutingPolicies(DEFAULT_ROUTING_POLICY, { euOnly: false }, { euOnly: true });
    expect(p.euOnly).toBe(true);
  });
});
