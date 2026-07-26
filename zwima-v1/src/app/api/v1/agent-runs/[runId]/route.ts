import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { getAgentRun } from "@/core/agents/agent-service";

export async function GET(req: Request, ctxParams: { params: Promise<{ runId: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { runId } = await ctxParams.params;
    const result = await getAgentRun(ctx, runId);
    return agentSuccess(result, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}
