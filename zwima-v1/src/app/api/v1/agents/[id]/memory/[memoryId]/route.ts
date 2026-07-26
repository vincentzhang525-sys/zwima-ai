import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { deleteAgentMemoryEntry } from "@/core/agents/agent-service";

export async function DELETE(req: Request, ctxParams: { params: Promise<{ id: string; memoryId: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id, memoryId } = await ctxParams.params;
    await deleteAgentMemoryEntry(ctx, id, memoryId);
    return agentSuccess({ deleted: true, memoryId }, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}
