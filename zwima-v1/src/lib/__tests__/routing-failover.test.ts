import { describe, expect, it } from "vitest";
import { isFallbackAllowedError } from "../routing/failover-engine";

describe("routing-failover isolated", () => {
  it("compliance block does not fallback", () => {
    expect(isFallbackAllowedError(new Error("compliance block"))).toBe(false);
  });

  it("network timeout allows fallback", () => {
    expect(isFallbackAllowedError(new Error("network timeout"))).toBe(true);
  });
});
