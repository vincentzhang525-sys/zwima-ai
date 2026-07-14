import { describe, it, expect } from "vitest";
import { creditsToEur, formatEur, paginate } from "@/lib/workspace/http";

describe("workspace-overview", () => {
  it("formats EUR amounts from credits", () => {
    expect(formatEur(2500)).toBe("€2.5000");
    expect(creditsToEur(0)).toBe(0);
  });

  it("empty trend data yields zero-length pagination items", () => {
    const result = paginate([], 1, 25);
    expect(result.items).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it("overview response must not include raw API key material", () => {
    const sample = {
      creditBalance: 1000,
      recentRequests: [{ id: "1", provider: "openai", model: "gpt", costEur: 0.01 }],
    };
    expect(JSON.stringify(sample)).not.toMatch(/sk_live_/);
  });
});
