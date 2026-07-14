import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import { getWorkspaceLogDetail } from "@/lib/workspace/logs-service";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireWorkspaceContext();
    const { id } = await params;
    const log = await getWorkspaceLogDetail(ctx.organizationId, id);
    if (!log) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Not found" } }, { status: 404 });
    }
    return NextResponse.json({ log });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
