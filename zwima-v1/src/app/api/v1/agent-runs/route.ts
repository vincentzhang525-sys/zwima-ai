import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { listAgentRuns } from "@/core/agents/agent-service";
import type { AgentRunStatus } from "@/lib/agents/types";

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const url = new URL(req.url);
    const rows = await listAgentRuns(ctx, {
      agentId: url.searchParams.get("agentId") || undefined,
      status: (url.searchParams.get("status") as AgentRunStatus | null) || undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    return agentSuccess(rows, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}
