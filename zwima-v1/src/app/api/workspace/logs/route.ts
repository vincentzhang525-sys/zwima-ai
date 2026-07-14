import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import { getWorkspaceLogs } from "@/lib/workspace/logs-service";
import { logsQuerySchema, parseQuery } from "@/lib/workspace/schemas";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const { searchParams } = new URL(req.url);
    const query = parseQuery(logsQuerySchema, Object.fromEntries(searchParams.entries()));
    const data = await getWorkspaceLogs(ctx.organizationId, query);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
