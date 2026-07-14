import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import { getWorkspaceUsage } from "@/lib/workspace/usage-service";
import { usageQuerySchema, parseQuery } from "@/lib/workspace/schemas";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const { searchParams } = new URL(req.url);
    const query = parseQuery(usageQuerySchema, Object.fromEntries(searchParams.entries()));
    const data = await getWorkspaceUsage(ctx.organizationId, query);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
