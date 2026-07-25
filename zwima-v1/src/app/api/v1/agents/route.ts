import { z } from "zod";
import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { createAgent, listAgents } from "@/lib/agents/registry-service";
import type { AgentLifecycleStatus } from "@/lib/agents/types";

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  workspaceId: z.string().nullable().optional(),
  systemPrompt: z.string().min(1),
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

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const url = new URL(req.url);
    const rows = await listAgents(ctx, {
      workspaceId: url.searchParams.get("workspaceId"),
      status: (url.searchParams.get("status") as AgentLifecycleStatus | null) || undefined,
      limit: Number(url.searchParams.get("limit") || 50),
    });
    return agentSuccess(rows, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const parsed = CreateSchema.parse(await req.json());
    const created = await createAgent(ctx, parsed);
    return agentSuccess(created, rid, { status: 201 });
  } catch (err) {
    return agentError(err, requestId);
  }
}
