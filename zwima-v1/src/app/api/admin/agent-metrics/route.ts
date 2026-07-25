import { requireAdmin } from "@/lib/admin";
import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { getAgentPlatformMetrics } from "@/lib/agents/metrics-service";

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    await requireAdmin();
    const { ctx, requestId: rid } = await withAgent(req);
    return agentSuccess(await getAgentPlatformMetrics(ctx), rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}
