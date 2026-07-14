import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import { runWorkspacePlayground } from "@/lib/workspace/playground-service";
import { playgroundSchema, parseBody } from "@/lib/workspace/schemas";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const body = parseBody(playgroundSchema, await req.json());
    const result = await runWorkspacePlayground({
      userId: ctx.user.id,
      organizationId: ctx.organizationId,
      ...body,
    });
    if ("error" in result && result.error) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
