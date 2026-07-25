import { assertAgentPermission, type AgentContext } from "./auth";
import { getAgentDb, type AgentLifecycleStatus, type AgentRunStatus } from "./types";

export type AgentPlatformMetrics = {
  agentsByStatus: Record<AgentLifecycleStatus, number>;
  runsByStatus: Record<AgentRunStatus, number>;
  totalAgents: number;
  totalRuns: number;
  totalToolExecutions: number;
  pendingReviewLinks: number;
  estimatedCostTotal: number;
};

const AGENT_STATUSES: AgentLifecycleStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "DEPRECATED", "ARCHIVED"];
const RUN_STATUSES: AgentRunStatus[] = [
  "QUEUED",
  "RUNNING",
  "WAITING_TOOL",
  "WAITING_REVIEW",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
];

/** Simple admin-facing aggregates for the agent platform, all scoped to the caller's organization. */
export async function getAgentPlatformMetrics(ctx: AgentContext): Promise<AgentPlatformMetrics> {
  assertAgentPermission(ctx, "admin");
  const db = getAgentDb();

  const [agentCounts, runCounts, totalToolExecutions, pendingReviewLinks, allRuns] = await Promise.all([
    Promise.all(
      AGENT_STATUSES.map((status) =>
        db.agentDefinition.count({ where: { organizationId: ctx.organizationId, status } }),
      ),
    ),
    Promise.all(
      RUN_STATUSES.map((status) => db.agentRun.count({ where: { organizationId: ctx.organizationId, status } })),
    ),
    db.toolExecution.count({ where: { organizationId: ctx.organizationId } }),
    db.agentReviewLink.count({ where: { organizationId: ctx.organizationId, status: "PENDING" } }),
    db.agentRun.findMany({ where: { organizationId: ctx.organizationId }, select: { costEstimate: true } }),
  ]);

  const agentsByStatus = AGENT_STATUSES.reduce((acc, status, i) => {
    acc[status] = agentCounts[i];
    return acc;
  }, {} as Record<AgentLifecycleStatus, number>);

  const runsByStatus = RUN_STATUSES.reduce((acc, status, i) => {
    acc[status] = runCounts[i];
    return acc;
  }, {} as Record<AgentRunStatus, number>);

  const estimatedCostTotal = allRuns.reduce((sum, r) => sum + (r.costEstimate ?? 0), 0);

  return {
    agentsByStatus,
    runsByStatus,
    totalAgents: agentCounts.reduce((a, b) => a + b, 0),
    totalRuns: runCounts.reduce((a, b) => a + b, 0),
    totalToolExecutions,
    pendingReviewLinks,
    estimatedCostTotal: Number(estimatedCostTotal.toFixed(6)),
  };
}
