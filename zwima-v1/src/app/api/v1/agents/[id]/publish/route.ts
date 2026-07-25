import { z } from "zod";
import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { publishAgentVersion } from "@/lib/agents/registry-service";

const Schema = z.object({ versionId: z.string().min(1) });

export async function POST(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || "req";
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    await ctxParams.params; // agent id validated via version ownership
    const { versionId } = Schema.parse(await req.json());
    const version = await publishAgentVersion(ctx, versionId);
    return agentSuccess(version, rid);
  } catch (err) {
    return agentError(err, requestId);
  }
}
