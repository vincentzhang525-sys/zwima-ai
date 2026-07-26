import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { createAgentTemplate, listAgentTemplates } from "@/core/agents/agent-service";
import { CreateAgentTemplateSchema, ListAgentTemplatesQuerySchema } from "@/core/agents/agent-types";

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const url = new URL(req.url);
    const query = ListAgentTemplatesQuerySchema.parse({
      category: url.searchParams.get("category") || undefined,
      includeInactive: url.searchParams.get("includeInactive") === "true" ? true : undefined,
    });
    const rows = await listAgentTemplates(ctx, query);
    return agentSuccess(rows, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const parsed = CreateAgentTemplateSchema.parse(await req.json());
    const template = await createAgentTemplate(ctx, parsed);
    return agentSuccess(template, rid, { status: 201 });
  } catch (err) {
    return agentError(err, requestId);
  }
}
