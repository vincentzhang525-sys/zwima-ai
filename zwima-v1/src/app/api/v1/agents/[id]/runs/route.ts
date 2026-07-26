import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { listAgentRuns, runAgent } from "@/core/agents/agent-service";
import { RunAgentSchema } from "@/core/agents/agent-types";
import type { AgentRunStatus } from "@/lib/agents/types";

export async function GET(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    const url = new URL(req.url);
    const rows = await listAgentRuns(ctx, {
      agentId: id,
      status: (url.searchParams.get("status") as AgentRunStatus | null) || undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
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
    const url = new URL(req.url);
    const body = RunAgentSchema.parse(await req.json().catch(() => ({})));
    const idempotencyKey = req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key");
    const execute = url.searchParams.get("execute") === "false" ? false : body.execute;
    const result = await runAgent(ctx, id, {
      ...body,
      execute,
      idempotencyKey: body.idempotencyKey ?? idempotencyKey,
    });
    return agentSuccess(result.run, rid, { status: 201 });
  } catch (err) {
    return agentError(err, requestId);
  }
}
