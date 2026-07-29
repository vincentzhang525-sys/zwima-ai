import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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
  let auth_ms = 0;
  let user_lookup_ms = 0;
  let organization_lookup_ms = 0;
  let membership_lookup_ms = 0;

  try {
    const tAuth = Date.now();
    const session = await auth();
    auth_ms = Date.now() - tAuth;

    const tCtx = Date.now();
    const ctx = await requireWorkspaceContext();
    const ctxMs = Date.now() - tCtx;
    // Approximate splits: membership+org resolved inside context after user lookup
    user_lookup_ms = ctxMs;
    membership_lookup_ms = ctxMs;
    organization_lookup_ms = 0;
    userIdPresent = Boolean(ctx.user?.id) || Boolean(session.userId);

    const tOverview = Date.now();
    const data = await getWorkspaceOverview(ctx.organizationId, ctx.user.id, {
      requestId,
      organizationName: ctx.organization.name,
    });
    const overviewMs = Date.now() - tOverview;

    const total_ms = Date.now() - t0;
    console.info(
      JSON.stringify({
        msg: "workspace.overview",
        requestId,
        userIdPresent,
        httpStatus: 200,
        auth_ms,
        user_lookup_ms,
        organization_lookup_ms,
        membership_lookup_ms,
        credit_balance_ms: null,
        usage_aggregation_ms: null,
        billing_lookup_ms: 0,
        overviewMs,
        total_ms,
      }),
    );

    return NextResponse.json(data, {
      headers: {
        "x-zwima-request-id": requestId,
        "server-timing": `auth;dur=${auth_ms},ctx;dur=${ctxMs},overview;dur=${overviewMs},total;dur=${total_ms}`,
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
          auth_ms,
          total_ms: Date.now() - t0,
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
      }),
    );
    return validationError(err instanceof Error ? err.message : "Failed");
  }
}
