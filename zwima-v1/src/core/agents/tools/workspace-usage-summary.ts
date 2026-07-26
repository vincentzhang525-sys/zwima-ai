/**
 * workspace_usage_summary — read-only summary of the calling organization's
 * (optionally workspace-scoped) agent usage, backed by Prisma aggregate
 * queries only (no raw SQL, no string interpolation into a query). The
 * organization/workspace scope always comes from the trusted
 * `ToolExecutionContext` (server-derived), never from tool `input` — a
 * caller cannot use this tool to read another organization's data.
 *
 * If the database is unavailable, returns an all-zero summary with
 * `source: "mock"` rather than throwing, so a tool failure never crashes an
 * otherwise-healthy mock run.
 */

import { prisma } from "@/lib/prisma";
import type { ToolDescriptor, ToolExecutionContext, ToolInput, ToolOutput } from "./tool-types";

export async function workspaceUsageSummaryTool(
  _input: ToolInput,
  context: ToolExecutionContext,
): Promise<ToolOutput> {
  if (!context.organizationId) {
    return {
      organizationId: null,
      workspaceId: context.workspaceId ?? null,
      totalRuns: 0,
      totalEstimatedCost: 0,
      runsByStatus: {},
      source: "mock",
      note: "No organization context available.",
    };
  }

  try {
    const where = {
      organizationId: context.organizationId,
      ...(context.workspaceId ? { workspaceId: context.workspaceId } : {}),
    };

    const [totalRuns, costAgg, grouped] = await Promise.all([
      prisma.agentRun.count({ where }),
      prisma.agentRun.aggregate({ where, _sum: { costEstimate: true } }),
      prisma.agentRun.groupBy({ by: ["status"], where, _count: { _all: true } }),
    ]);

    const runsByStatus: Record<string, number> = {};
    for (const row of grouped as Array<{ status: string; _count: { _all: number } }>) {
      runsByStatus[row.status] = row._count._all;
    }

    return {
      organizationId: context.organizationId,
      workspaceId: context.workspaceId ?? null,
      totalRuns,
      totalEstimatedCost: Number((costAgg._sum.costEstimate ?? 0).toFixed(6)),
      runsByStatus,
      source: "database",
    };
  } catch {
    return {
      organizationId: context.organizationId,
      workspaceId: context.workspaceId ?? null,
      totalRuns: 0,
      totalEstimatedCost: 0,
      runsByStatus: {},
      source: "mock",
      note: "Usage database unavailable; returning a safe zeroed summary.",
    };
  }
}

export const workspaceUsageSummaryToolDescriptor: ToolDescriptor = {
  key: "workspace_usage_summary",
  name: "Workspace Usage Summary",
  description:
    "Read-only summary of this organization's/workspace's agent run counts and estimated cost. Never accepts a caller-supplied organization/workspace id.",
  handler: workspaceUsageSummaryTool,
};
