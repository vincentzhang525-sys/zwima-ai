import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mapAgentError } from "./errors";
import { requireAgentContext, type AgentContext } from "./auth";

export function createAgentRequestId(existing?: string | null) {
  return existing && existing.trim() ? existing.trim() : randomUUID();
}

export function getRequestId(req: Request) {
  return createAgentRequestId(req.headers.get("x-request-id"));
}

export async function withAgent(req: Request): Promise<{
  ctx: AgentContext;
  requestId: string;
}> {
  const requestId = getRequestId(req);
  const ctx = await requireAgentContext();
  return { ctx, requestId };
}

export function agentSuccess<T>(
  data: T,
  requestId: string,
  init?: {
    status?: number;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  },
) {
  const body: Record<string, unknown> = {
    success: true,
    data,
    error: null,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
  if (init?.pagination) body.pagination = init.pagination;
  return NextResponse.json(body, { status: init?.status ?? 200 });
}

export function agentError(err: unknown, requestId: string) {
  const mapped = mapAgentError(err);
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: {
        code: mapped.code,
        message: mapped.message,
        details: mapped.details,
        retryable: mapped.retryable,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    },
    { status: mapped.status },
  );
}

export function buildAgentPagination(page: number, pageSize: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}
