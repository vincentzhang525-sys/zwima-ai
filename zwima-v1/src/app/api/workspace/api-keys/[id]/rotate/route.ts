import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import { rotateWorkspaceApiKey } from "@/lib/workspace/api-keys-workspace";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const ctx = await requireWorkspaceContext();
    const { assertCanAccess } = await import("@/lib/rbac");
    assertCanAccess(ctx.role, "api_keys");
    const { id } = await params;
    const data = await rotateWorkspaceApiKey(ctx.user.id, ctx.user.email, id);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
