import { z } from "zod";
import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { createRun, executeRun } from "@/lib/agents/execution-engine";

const Schema = z.object({
  input: z.record(z.string(), z.unknown()).default({}),
  workspaceId: z.string().nullable().optional(),
  execute: z.boolean().optional(),
  parentRunId: z.string().nullable().optional(),
});

export async function POST(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const { id } = await ctxParams.params;
    const body = Schema.parse(await req.json().catch(() => ({})));
    const idempotencyKey = req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key");
    let run = await createRun(ctx, {
      agentId: id,
      input: body.input,
      workspaceId: body.workspaceId,
      idempotencyKey,
      parentRunId: body.parentRunId,
    });
    const url = new URL(req.url);
    const shouldExecute = body.execute === true || url.searchParams.get("execute") === "true";
    if (shouldExecute) {
      run = await executeRun(ctx, run.runId);
    }
    return agentSuccess(run, rid, { status: 201 });
  } catch (err) {
    return agentError(err, requestId);
  }
}
