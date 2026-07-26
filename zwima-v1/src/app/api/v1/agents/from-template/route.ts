import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { createAgentFromTemplate } from "@/core/agents/agent-service";
import { CreateAgentFromTemplateSchema } from "@/core/agents/agent-types";

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const parsed = CreateAgentFromTemplateSchema.parse(await req.json());
    const result = await createAgentFromTemplate(ctx, parsed);
    return agentSuccess(result, rid, { status: 201 });
  } catch (err) {
    return agentError(err, requestId);
  }
}
