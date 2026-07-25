import { requireAdmin } from "@/lib/admin";
import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { listAgents } from "@/lib/agents/registry-service";

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    await requireAdmin();
    const { ctx, requestId: rid } = await withAgent(req);
    return agentSuccess(await listAgents(ctx, { limit: 200 }), rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}
