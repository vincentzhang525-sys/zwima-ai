import { NextRequest, NextResponse } from "next/server";
import { requireOverviewIdentity } from "@/lib/workspace/overview-identity";
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

  try {
    const { identity, timings: idTimings, cacheHit } = await requireOverviewIdentity();
    userIdPresent = true;

    const tOverview = Date.now();
    const data = await getWorkspaceOverview(identity.organizationId, identity.userId, {
      requestId,
      organizationName: identity.organizationName,
    });
    const overviewMs = Date.now() - tOverview;
    const serialization_ms = 0;
    const total_ms = Date.now() - t0;

    console.info(
      JSON.stringify({
        msg: "workspace.overview",
        requestId,
        userIdPresent,
        httpStatus: 200,
        auth_ms: idTimings.auth_ms,
        user_lookup_ms: idTimings.user_lookup_ms,
        membership_lookup_ms: idTimings.membership_lookup_ms,
        organization_ms: idTimings.organization_ms,
        identity_cache_hit: cacheHit,
        overviewMs,
        serialization_ms,
        total_ms,
        writeOps: 0,
      }),
    );

    return NextResponse.json(data, {
      headers: {
        "x-zwima-request-id": requestId,
        "server-timing": `auth;dur=${idTimings.auth_ms},user;dur=${idTimings.user_lookup_ms},overview;dur=${overviewMs},total;dur=${total_ms}`,
        "cache-control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      console.info(
        JSON.stringify({
          msg: "workspace.overview",
          requestId,
          userIdPresent,
          httpStatus: err.status,
          errorCode: err.code,
          total_ms: Date.now() - t0,
          writeOps: 0,
        }),
      );
      return errorResponse(err);
    }
    console.info(
      JSON.stringify({
        msg: "workspace.overview",
        requestId,
        userIdPresent,
        httpStatus: 400,
        errorCode: "VALIDATION",
        total_ms: Date.now() - t0,
        writeOps: 0,
      }),
    );
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
