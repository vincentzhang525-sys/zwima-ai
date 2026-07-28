import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import { updateWorkspaceApiKey } from "@/lib/workspace/api-keys-workspace";
import { updateApiKeySchema, parseBody } from "@/lib/workspace/schemas";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireWorkspaceContext();
    const { assertCanAccess } = await import("@/lib/rbac");
    assertCanAccess(ctx.role, "api_keys");
    const { id } = await params;
    const body = parseBody(updateApiKeySchema, await req.json());
    const key = await updateWorkspaceApiKey(ctx.user.id, ctx.user.email, id, body);
    return NextResponse.json({ key });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    if (err instanceof Error && err.message === "Not found") {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Not found" } }, { status: 404 });
    }
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
