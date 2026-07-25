import { NextResponse } from "next/server";
import { InternalAuthError, requireInternalServiceRole } from "@/lib/internal-auth";

/**
 * Internal-only Production parity stub.
 * Requires SERVICE_ROLE / admin. Does not call Live Providers or mutate via unauthenticated access.
 */
async function handle(req: Request) {
  try {
    await requireInternalServiceRole(req);
    return NextResponse.json(
      {
        ok: true,
        curated: true,
        message: "Internal route acknowledged on curated baseline (service-role required).",
      },
      { status: 200 },
    );
  } catch (err) {
    const status = err instanceof InternalAuthError ? 403 : 401;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
