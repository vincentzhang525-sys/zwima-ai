import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cacheClearAll,
  cacheGet,
  cacheSet,
  overviewApiKeysKey,
  overviewSlimKey,
} from "@/lib/workspace/overview-cache";
import { boundedOrgUsageWhere, overviewGetPathWriteOps } from "@/lib/workspace/overview-service";

describe("overview phase-2 performance contracts", () => {
  afterEach(() => {
    cacheClearAll();
    vi.restoreAllMocks();
  });

  it("GET path declares zero write operations", () => {
    expect(overviewGetPathWriteOps()).toEqual([]);
  });

  it("usage where is organization + time bounded", () => {
    const start = new Date("2026-07-01T00:00:00.000Z");
    const end = new Date("2026-08-01T00:00:00.000Z");
    const where = boundedOrgUsageWhere("org_a", { gte: start, lt: end });
    expect(where).toEqual({
      organizationId: "org_a",
      createdAt: { gte: start, lt: end },
    });
  });

  it("cache isolates organizations", () => {
    cacheSet(overviewApiKeysKey("org_a"), 3, 30_000);
    cacheSet(overviewApiKeysKey("org_b"), 9, 30_000);
    expect(cacheGet<number>(overviewApiKeysKey("org_a"))).toBe(3);
    expect(cacheGet<number>(overviewApiKeysKey("org_b"))).toBe(9);
  });

  it("slim cache keys isolate by organization and user", () => {
    cacheSet(overviewSlimKey("org_a", "user_1"), { creditBalance: 1 }, 5_000);
    cacheSet(overviewSlimKey("org_a", "user_2"), { creditBalance: 2 }, 5_000);
    expect(cacheGet<{ creditBalance: number }>(overviewSlimKey("org_a", "user_1"))?.creditBalance).toBe(1);
    expect(cacheGet<{ creditBalance: number }>(overviewSlimKey("org_a", "user_2"))?.creditBalance).toBe(2);
  });

  it("details deferral contract keeps first-screen payload free of recent tables", () => {
    const firstScreen = {
      organization: { id: "o1", name: "Acme" },
      creditBalance: 1000,
      monthCostEur: 0.5,
      todayRequests: 2,
      activeApiKeys: 1,
      activeProjects: 1,
      usageTrend: [],
      recentRequests: [],
      recentBilling: [],
      providerDistribution: [],
      modelDistribution: [],
      detailsDeferred: true,
    };
    expect(firstScreen.detailsDeferred).toBe(true);
    expect(firstScreen.recentRequests).toEqual([]);
    expect(firstScreen.providerDistribution).toEqual([]);
  });
});
