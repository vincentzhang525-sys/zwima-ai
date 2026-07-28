import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import { getWorkspaceBilling } from "@/lib/workspace/billing-service";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    // VIEWER has no billing permission — fail-closed (GAP-012).
    if (ctx.role === "VIEWER") {
      throw new ApiError("FORBIDDEN", "Insufficient permission for resource: billing", 403);
    }
    const data = await getWorkspaceBilling(ctx.user.id, ctx.organizationId);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
