import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { deleteAgentTemplate, getAgentTemplate, updateAgentTemplate } from "@/core/agents/agent-service";
import { UpdateAgentTemplateSchema } from "@/core/agents/agent-types";

export async function GET(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    const template = await getAgentTemplate(ctx, id);
    return agentSuccess(template, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}

export async function PATCH(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    const parsed = UpdateAgentTemplateSchema.parse(await req.json());
    const template = await updateAgentTemplate(ctx, id, parsed);
    return agentSuccess(template, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}

export async function DELETE(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    await deleteAgentTemplate(ctx, id);
    return agentSuccess({ deleted: true, templateId: id }, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}
