import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/lib/workspace/workspace-context";
import { getWorkspaceOverview } from "@/lib/workspace/overview-service";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ov-${Date.now()}`;
}

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-zwima-request-id") || newRequestId();
  const t0 = Date.now();
  let userIdPresent = false;
  let httpStatus = 200;

  try {
    const tCtx = Date.now();
    const ctx = await requireWorkspaceContext();
    const ctxMs = Date.now() - tCtx;
    userIdPresent = Boolean(ctx.user?.id);

    const tOverview = Date.now();
    const data = await getWorkspaceOverview(ctx.organizationId, ctx.user.id, { requestId });
    const overviewMs = Date.now() - tOverview;

    console.info(
      JSON.stringify({
        msg: "workspace.overview",
        requestId,
        userIdPresent,
        httpStatus: 200,
        ctxMs,
        overviewMs,
        totalMs: Date.now() - t0,
      }),
    );

    return NextResponse.json(data, {
      headers: { "x-zwima-request-id": requestId },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      httpStatus = err.status;
      console.info(
        JSON.stringify({
          msg: "workspace.overview",
          requestId,
          userIdPresent,
          httpStatus,
          errorCode: err.code,
          totalMs: Date.now() - t0,
        }),
      );
      return errorResponse(err);
    }
    httpStatus = 400;
    console.info(
      JSON.stringify({
        msg: "workspace.overview",
        requestId,
        userIdPresent,
        httpStatus,
        errorCode: "VALIDATION",
        totalMs: Date.now() - t0,
      }),
    );
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
