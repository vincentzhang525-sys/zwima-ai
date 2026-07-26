import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { archiveAgent, getAgent, updateAgent } from "@/core/agents/agent-service";
import { UpdateAgentSchema } from "@/core/agents/agent-types";

export async function GET(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    const result = await getAgent(ctx, id);
    return agentSuccess(result, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}

export async function PATCH(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    const parsed = UpdateAgentSchema.parse(await req.json());
    const agent = await updateAgent(ctx, id, parsed);
    return agentSuccess(agent, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}

export async function DELETE(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    const agent = await archiveAgent(ctx, id);
    return agentSuccess(agent, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}
