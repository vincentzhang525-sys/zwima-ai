import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { clearAgentMemory, createAgentMemoryEntry, listAgentMemoryEntries } from "@/core/agents/agent-service";
import { CreateAgentMemoryEntrySchema, ListAgentMemoryQuerySchema } from "@/core/agents/agent-types";

export async function GET(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    const url = new URL(req.url);
    const query = ListAgentMemoryQuerySchema.parse({
      memoryType: url.searchParams.get("memoryType") || undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    const rows = await listAgentMemoryEntries(ctx, id, query);
    return agentSuccess(rows, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}

export async function POST(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    const parsed = CreateAgentMemoryEntrySchema.parse(await req.json());
    const entry = await createAgentMemoryEntry(ctx, id, parsed);
    return agentSuccess(entry, rid, { status: 201 });
  } catch (err) {
    return agentError(err, requestId);
  }
}

/** Clears ALL memory entries for this agent (org-scoped). Use the `[memoryId]` route to delete a single entry. */
export async function DELETE(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    const result = await clearAgentMemory(ctx, id);
    return agentSuccess({ cleared: true, count: result.count }, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}
