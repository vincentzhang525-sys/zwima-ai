import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import {
  listWorkspaceApiKeys,
  createWorkspaceApiKey,
} from "@/lib/workspace/api-keys-workspace";
import { createApiKeySchema, parseBody } from "@/lib/workspace/schemas";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    const { assertCanAccess } = await import("@/lib/rbac");
    assertCanAccess(ctx.role, "api_keys");
    const data = await listWorkspaceApiKeys(ctx.user.id, ctx.user.email);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const { assertCanAccess } = await import("@/lib/rbac");
    assertCanAccess(ctx.role, "api_keys");
    const body = parseBody(createApiKeySchema, await req.json());
    const data = await createWorkspaceApiKey(ctx.user.id, ctx.user.email, body);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
