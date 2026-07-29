import { NextRequest, NextResponse } from "next/server";
import { requireOverviewIdentity } from "@/lib/workspace/overview-identity";
import { getWorkspaceOverviewDetails } from "@/lib/workspace/overview-service";
import { errorResponse, validationError } from "@/lib/workspace/http";
import { ApiError } from "@/lib/api-errors";

function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ovd-${Date.now()}`;
}

/** Deferred charts / recent tables — must not block first-screen overview. */
export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-zwima-request-id") || newRequestId();
  const t0 = Date.now();
  try {
    const { identity } = await requireOverviewIdentity();
    const data = await getWorkspaceOverviewDetails(identity.organizationId, identity.userId, {
      requestId,
    });
    console.info(
      JSON.stringify({
        msg: "workspace.overview.details",
        requestId,
        userIdPresent: true,
        httpStatus: 200,
        total_ms: Date.now() - t0,
        writeOps: 0,
      }),
    );
    return NextResponse.json(data, {
      headers: { "x-zwima-request-id": requestId },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      console.info(
        JSON.stringify({
          msg: "workspace.overview.details",
          requestId,
          httpStatus: err.status,
          errorCode: err.code,
          total_ms: Date.now() - t0,
          writeOps: 0,
        }),
      );
      return errorResponse(err);
    }
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
