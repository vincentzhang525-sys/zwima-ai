import { z } from "zod";
import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { archiveAgent, getAgent, listAgentVersions, updateAgentMeta } from "@/lib/agents/registry-service";

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export async function GET(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    const agent = await getAgent(ctx, id);
    const versions = await listAgentVersions(ctx, id);
    return agentSuccess({ agent, versions }, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}

export async function PATCH(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    const parsed = PatchSchema.parse(await req.json());
    const agent = await updateAgentMeta(ctx, id, parsed);
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
