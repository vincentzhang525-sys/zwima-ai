import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { auditAdminFxAccess, listRepricingAlertsAdmin } from "@/lib/fx";

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) throw new Error("Forbidden");
    const url = new URL(req.url);
    const ack = url.searchParams.get("acknowledged");
    const data = await listRepricingAlertsAdmin({
      page: Number(url.searchParams.get("page") || 1),
      pageSize: Number(url.searchParams.get("pageSize") || 20),
      status: url.searchParams.get("status") || undefined,
      acknowledged: ack == null ? undefined : ack === "true",
    });
    await auditAdminFxAccess(admin.emailAddresses[0]?.emailAddress, "FX_REPRICING_ALERTS_LIST", {
      page: data.page,
      total: data.total,
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
