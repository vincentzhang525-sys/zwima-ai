import { NextResponse } from "next/server";
import { withAgent, agentSuccess, agentError } from "@/lib/agents/http";
import { seedAgentPlatformDefaults } from "@/lib/agents/seed-agents";

/**
 * Explicit authenticated seed only.
 * Blocked on Preview/Development and unless AGENT_SEED_AUTHORIZED=true.
 * Never invoked by vercel-build.
 */
export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") || "req";
  const vercelEnv = (process.env.VERCEL_ENV || "").toLowerCase();
  if (vercelEnv === "preview" || vercelEnv === "development") {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: "AGENT_SEED_BLOCKED", message: "Agent seed is disabled on Preview/Development." },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      { status: 403 },
    );
  }
  if (process.env.AGENT_SEED_AUTHORIZED !== "true") {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: "AGENT_SEED_UNAUTHORIZED", message: "Set AGENT_SEED_AUTHORIZED=true for explicit seed." },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      { status: 403 },
    );
  }
  try {
    const { ctx, requestId: rid } = await withAgent(req);
    const result = await seedAgentPlatformDefaults(ctx);
    return agentSuccess(result, rid, { status: 201 });
  } catch (err) {
    return agentError(err, requestId);
  }
}
