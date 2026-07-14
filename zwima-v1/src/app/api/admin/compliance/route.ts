import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getCurrentDbUser } from "@/lib/auth";
import { getAuditLogs } from "@/lib/audit";
import {
  listComplianceProfiles,
  logComplianceAudit,
  upsertComplianceProfile,
} from "@/lib/compliance/ai-compliance";

export async function GET() {
  try {
    await requireAdmin();
    const [profiles, auditLogs] = await Promise.all([
      listComplianceProfiles(),
      getAuditLogs({ category: "COMPLIANCE", limit: 50 }),
    ]);
    return NextResponse.json({ profiles, auditLogs });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const user = await getCurrentDbUser();
    const body = await req.json();
    const { providerModelId, ...input } = body;
    if (!providerModelId) {
      return NextResponse.json({ error: "providerModelId required" }, { status: 400 });
    }
    const profile = await upsertComplianceProfile(providerModelId, {
      ...input,
      reviewedBy: user?.id,
    });
    await logComplianceAudit({
      userId: user?.id,
      providerModelId,
      action: "compliance_profile_updated",
      detail: input,
    });
    return NextResponse.json({ profile });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
