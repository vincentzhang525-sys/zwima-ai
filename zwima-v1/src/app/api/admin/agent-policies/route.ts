import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { listAgentOrgPolicies, upsertAgentOrgPolicy } from "@/lib/agents/policy-service";

const Schema = z.object({
  key: z.string().min(1),
  value: z.record(z.string(), z.unknown()),
});

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    await requireAdmin();
    const { ctx, requestId: rid } = await withAgent(req);
    return agentSuccess(await listAgentOrgPolicies(ctx), rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}

export async function PUT(req: Request) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    await requireAdmin();
    const { ctx, requestId: rid } = await withAgent(req);
    const parsed = Schema.parse(await req.json());
    return agentSuccess(await upsertAgentOrgPolicy(ctx, parsed), rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}
