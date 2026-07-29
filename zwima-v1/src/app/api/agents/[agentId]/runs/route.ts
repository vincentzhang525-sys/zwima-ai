import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { withAgent, agentError, getRequestId } from "@/lib/agents/http";
import { assertAgentPermission } from "@/lib/agents/auth";
import { AgentServiceError } from "@/lib/agents/errors";
import { getAgentDb } from "@/lib/agents/types";
import {
  Gap020RunRequestSchema,
  runAgent,
  formatRuntimeLogLine,
  type AgentRuntimeResult,
} from "@/core/agents/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GAP-020 Preview-safe Agent Runtime API.
 * POST /api/agents/[agentId]/runs
 * Auth + org membership + agent ownership required.
 * Only MOCK / PREVIEW_SAFE executionMode.
 */
export async function POST(
  req: Request,
  ctxParams: { params: Promise<{ agentId: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const { ctx } = await withAgent(req);
    assertAgentPermission(ctx, "edit");

    const { agentId } = await ctxParams.params;
    if (!agentId?.trim()) {
      throw new AgentServiceError("VALIDATION_ERROR", "agentId is required", 400);
    }

    const rawBody = await req.json().catch(() => ({}));
    const body = Gap020RunRequestSchema.parse(rawBody);
    const idempotencyKey =
      body.idempotencyKey ??
      req.headers.get("idempotency-key") ??
      req.headers.get("Idempotency-Key") ??
      req.headers.get("x-request-id");

    const db = getAgentDb();
    const agent = await db.agentDefinition.findUnique({ where: { agentId } });
    if (!agent) {
      throw new AgentServiceError("NOT_FOUND", "Agent not found", 404);
    }
    if (agent.organizationId !== ctx.organizationId) {
      throw new AgentServiceError("FORBIDDEN", "Agent does not belong to this workspace", 403);
    }
    if (body.workspaceId && agent.workspaceId && body.workspaceId !== agent.workspaceId) {
      throw new AgentServiceError(
        "FORBIDDEN",
        "Agent does not belong to the requested workspaceId",
        403,
      );
    }

    const controller = new AbortController();
    const timeoutMs = body.timeoutMs ?? 15_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let result: AgentRuntimeResult;
    try {
      result = await runAgent({
        agentId,
        workspaceId: body.workspaceId ?? agent.workspaceId ?? null,
        userId: ctx.user.id,
        input: {
          ...body.input,
          ...(body.scenario ? { scenario: body.scenario } : {}),
        },
        executionMode: body.executionMode,
        agentEnabled: agent.status === "ACTIVE",
        agentOrganizationId: agent.organizationId,
        agentWorkspaceId: agent.workspaceId,
        callerOrganizationId: ctx.organizationId,
        idempotencyKey,
        requestId,
        signal: controller.signal,
        timeoutMs,
        scenario: body.scenario,
        liveProviderAllowed: false,
      });
    } finally {
      clearTimeout(timer);
    }

    // Structured safe log — no secrets / full input / connection strings.
    console.info(formatRuntimeLogLine(result));

    if (result.status === "BLOCKED_BY_SAFETY_GATE") {
      return NextResponse.json(
        {
          success: false,
          data: result,
          error: {
            code: result.error?.code ?? "BLOCKED_BY_SAFETY_GATE",
            message: result.error?.message ?? "Blocked by safety gate",
            retryable: false,
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        },
        { status: 403 },
      );
    }

    if (result.status === "TIMED_OUT") {
      return NextResponse.json(
        {
          success: false,
          data: result,
          error: {
            code: result.error?.code ?? "TIMED_OUT",
            message: result.error?.message ?? "Run timed out",
            retryable: true,
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        },
        { status: 504 },
      );
    }

    if (result.status === "FAILED" || result.status === "CANCELLED") {
      return NextResponse.json(
        {
          success: false,
          data: result,
          error: {
            code: result.error?.code ?? result.status,
            message: result.error?.message ?? `Run ${result.status.toLowerCase()}`,
            retryable: false,
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        },
        { status: result.status === "CANCELLED" ? 409 : 422 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
        error: null,
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request payload",
            details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
            retryable: false,
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        },
        { status: 400 },
      );
    }
    return agentError(err, requestId);
  }
}
