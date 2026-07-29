import { describe, expect, it } from "vitest";
import { boundedOrgUsageWhere } from "@/lib/workspace/overview-service";

describe("boundedOrgUsageWhere", () => {
  it("requires organizationId and month start/end bounds", () => {
    const start = new Date("2026-07-01T00:00:00.000Z");
    const end = new Date("2026-08-01T00:00:00.000Z");
    const where = boundedOrgUsageWhere("org_1", { gte: start, lt: end });
    expect(where.organizationId).toBe("org_1");
    expect(where.createdAt).toEqual({ gte: start, lt: end });
  });

  it("supports open-ended lower bound for today queries", () => {
    const start = new Date("2026-07-29T00:00:00.000Z");
    const where = boundedOrgUsageWhere("org_1", { gte: start });
    expect(where.createdAt).toEqual({ gte: start });
  });
});

describe("overview first-screen contract", () => {
  it("marks expensive fields as deferrable defaults", () => {
    const firstScreen = {
      organization: { id: "o1", name: "Acme" },
      creditBalance: 1000,
      monthCostEur: 0.12,
      usageTrend: [],
      recentRequests: [],
      recentBilling: [],
      providerDistribution: [],
      modelDistribution: [],
      detailsDeferred: true,
    };
    expect(firstScreen.detailsDeferred).toBe(true);
    expect(firstScreen.usageTrend).toEqual([]);
    expect(JSON.stringify(firstScreen)).not.toMatch(/sk_live_/);
  });
});
