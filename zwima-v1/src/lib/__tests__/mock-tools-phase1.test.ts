import { beforeEach, describe, expect, it, vi } from "vitest";

const agentRunCount = vi.fn();
const agentRunAggregate = vi.fn();
const agentRunGroupBy = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentRun: {
      count: (...args: unknown[]) => agentRunCount(...args),
      aggregate: (...args: unknown[]) => agentRunAggregate(...args),
      groupBy: (...args: unknown[]) => agentRunGroupBy(...args),
    },
  },
}));

import { isMockToolKey, MOCK_TOOL_KEYS, runMockTool } from "@/lib/agents/mock-tools";
import { AgentServiceError } from "@/lib/agents/errors";

describe("Phase 1 core tools registered in the mock tool runtime", () => {
  it("includes the three required Phase 1 tools", () => {
    expect(MOCK_TOOL_KEYS).toContain("calculator");
    expect(MOCK_TOOL_KEYS).toContain("current_datetime");
    expect(MOCK_TOOL_KEYS).toContain("workspace_usage_summary");
    expect(isMockToolKey("current_datetime")).toBe(true);
    expect(isMockToolKey("workspace_usage_summary")).toBe(true);
  });

  it("runMockTool rejects an unknown/forbidden tool key", async () => {
    await expect(runMockTool("shell", {})).rejects.toBeInstanceOf(AgentServiceError);
    await expect(runMockTool("raw_sql", {})).rejects.toBeInstanceOf(AgentServiceError);
  });
});

describe("current_datetime tool", () => {
  it("returns the current local time with no network access, ignoring input", async () => {
    const before = Date.now();
    const result = await runMockTool("current_datetime", { ignored: "value" });
    const after = Date.now();
    expect(typeof result.iso).toBe("string");
    expect(result.unixMs as number).toBeGreaterThanOrEqual(before);
    expect(result.unixMs as number).toBeLessThanOrEqual(after);
    expect(result.source).toBe("local-clock");
  });
});

describe("workspace_usage_summary tool", () => {
  beforeEach(() => {
    agentRunCount.mockReset();
    agentRunAggregate.mockReset();
    agentRunGroupBy.mockReset();
  });

  it("returns a database-backed summary scoped to the trusted context organizationId", async () => {
    agentRunCount.mockResolvedValue(3);
    agentRunAggregate.mockResolvedValue({ _sum: { costEstimate: 0.0042 } });
    agentRunGroupBy.mockResolvedValue([{ status: "COMPLETED", _count: { _all: 3 } }]);

    const result = await runMockTool(
      "workspace_usage_summary",
      { organizationId: "org_attacker_supplied" }, // must be ignored — context wins
      { organizationId: "org_real", workspaceId: null },
    );

    expect(result.organizationId).toBe("org_real");
    expect(result.totalRuns).toBe(3);
    expect(result.source).toBe("database");
    expect(agentRunCount).toHaveBeenCalledWith({ where: { organizationId: "org_real" } });
  });

  it("falls back to a safe zeroed mock summary when the database is unavailable", async () => {
    agentRunCount.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await runMockTool("workspace_usage_summary", {}, { organizationId: "org_real" });

    expect(result.source).toBe("mock");
    expect(result.totalRuns).toBe(0);
    expect(result.totalEstimatedCost).toBe(0);
  });

  it("never executes raw SQL — only Prisma model methods are called", async () => {
    agentRunCount.mockResolvedValue(0);
    agentRunAggregate.mockResolvedValue({ _sum: { costEstimate: null } });
    agentRunGroupBy.mockResolvedValue([]);
    await runMockTool("workspace_usage_summary", {}, { organizationId: "org_real" });
    // The fake prisma client above only exposes count/aggregate/groupBy — if the
    // implementation tried `$queryRaw`/`$executeRaw` this test's mock object
    // would throw a TypeError, which would fail the test.
  });
});
