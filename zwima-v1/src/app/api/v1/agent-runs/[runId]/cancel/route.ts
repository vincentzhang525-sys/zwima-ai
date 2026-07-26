import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { CancelAgentRunSchema } from "@/core/agents/agent-types";
import { cancelAgentRun } from "@/core/agents/agent-service";

export async function POST(req: Request, ctxParams: { params: Promise<{ runId: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { runId } = await ctxParams.params;
    const body = CancelAgentRunSchema.parse(await req.json().catch(() => ({})));
    const run = await cancelAgentRun(ctx, runId, body.reason);
    return agentSuccess(run, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}
