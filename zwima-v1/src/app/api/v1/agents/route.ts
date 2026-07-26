import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { createAgent, listAgents } from "@/core/agents/agent-service";
import { CreateAgentSchema, ListAgentsQuerySchema } from "@/core/agents/agent-types";
import type { AgentLifecycleStatus } from "@/lib/agents/types";

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const url = new URL(req.url);
    const query = ListAgentsQuerySchema.parse({
      workspaceId: url.searchParams.get("workspaceId") || undefined,
      status: (url.searchParams.get("status") as AgentLifecycleStatus | null) || undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    const rows = await listAgents(ctx, query);
    return agentSuccess(rows, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const parsed = CreateAgentSchema.parse(await req.json());
    const created = await createAgent(ctx, parsed);
    return agentSuccess(created, rid, { status: 201 });
  } catch (err) {
    return agentError(err, requestId);
  }
}
