import { z } from "zod";
import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { getAgent, listAgentVersions } from "@/lib/agents/registry-service";
import { updateAgentVersionConfig } from "@/lib/agents/config-service";

const Schema = z.object({
  versionId: z.string().min(1),
  systemPrompt: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(16).max(8192).optional(),
  toolIds: z.array(z.string()).optional(),
  memoryScope: z.enum(["CONVERSATION", "RUN", "WORKSPACE"]).optional(),
  maxDelegationDepth: z.number().int().min(0).max(5).optional(),
  maxDelegationChildren: z.number().int().min(0).max(10).optional(),
  reviewRequired: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
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
    await ctxParams.params;
    const parsed = Schema.parse(await req.json());
    const { versionId, ...patch } = parsed;
    const version = await updateAgentVersionConfig(ctx, versionId, patch);
    return agentSuccess(version, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}
