import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import { revokeWorkspaceApiKey } from "@/lib/workspace/api-keys-workspace";
import { revokeApiKeySchema, parseBody } from "@/lib/workspace/schemas";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await requireWorkspaceContext();
    const { id } = await params;
    const body = parseBody(revokeApiKeySchema, await req.json());
    await revokeWorkspaceApiKey(ctx.user.id, ctx.user.email, id, body.reason ?? "Revoked by user");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
