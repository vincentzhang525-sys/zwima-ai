import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { createAccountDeletionRequest } from "@/lib/compliance/legal-consent";

/**
 * Manual account/data deletion request (GAP-011).
 * Does not auto-delete data and does not send email — queues PENDING_MANUAL_REVIEW.
 */
export async function POST(req: Request) {
  try {
    const user = await requireDbUser();
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const row = await createAccountDeletionRequest({
      userId: user.id,
      reason: body.reason ?? null,
    });
    return NextResponse.json({
      ok: true,
      id: row.id,
      status: row.status,
      message:
        "Deletion request recorded for manual review. Automated erasure is not performed by this endpoint.",
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
