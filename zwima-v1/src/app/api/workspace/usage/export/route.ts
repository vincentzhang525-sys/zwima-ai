import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import { exportWorkspaceUsageCsv } from "@/lib/workspace/usage-service";
import { usageQuerySchema, parseQuery } from "@/lib/workspace/schemas";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const { searchParams } = new URL(req.url);
    const query = parseQuery(usageQuerySchema, Object.fromEntries(searchParams.entries()));
    const csv = await exportWorkspaceUsageCsv(ctx.organizationId, query);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="usage-export-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
