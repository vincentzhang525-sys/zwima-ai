import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { getAgentMemoryPolicy, upsertAgentMemoryPolicy } from "@/core/agents/agent-service";
import { UpsertAgentMemoryPolicySchema } from "@/core/agents/agent-types";

export async function GET(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    const policy = await getAgentMemoryPolicy(ctx, id);
    return agentSuccess(policy, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}

export async function PATCH(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    const parsed = UpsertAgentMemoryPolicySchema.parse(await req.json());
    const policy = await upsertAgentMemoryPolicy(ctx, id, parsed);
    return agentSuccess(policy, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}
