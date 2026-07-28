import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import {
  getConsentStatus,
  recordLegalConsent,
} from "@/lib/compliance/legal-consent";
import { currentLegalVersions } from "@/lib/compliance/legal-versions";

export async function GET() {
  try {
    const user = await requireDbUser();
    const status = await getConsentStatus(user.id);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireDbUser();
    const body = (await req.json().catch(() => ({}))) as { accept?: boolean };
    if (body.accept !== true) {
      return NextResponse.json(
        { error: "accept must be true to record consent" },
        { status: 400 },
      );
    }

    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? null;
    const userAgent = req.headers.get("user-agent");

    const row = await recordLegalConsent({
      userId: user.id,
      ip,
      userAgent,
      source: "dashboard",
    });

    return NextResponse.json({
      ok: true,
      bundleVersion: row.bundleVersion,
      acceptedAt: row.acceptedAt.toISOString(),
      documents: currentLegalVersions(),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
