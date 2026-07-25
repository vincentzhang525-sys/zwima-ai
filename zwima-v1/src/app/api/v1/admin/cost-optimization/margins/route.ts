import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { auditAdminFxAccess, listMarginsAdmin } from "@/lib/fx";

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) throw new Error("Forbidden");
    const url = new URL(req.url);
    const data = await listMarginsAdmin({
      page: Number(url.searchParams.get("page") || 1),
      pageSize: Number(url.searchParams.get("pageSize") || 20),
      providerId: url.searchParams.get("provider") || url.searchParams.get("providerId") || undefined,
      currency: url.searchParams.get("currency") || undefined,
      organizationId: url.searchParams.get("organization") || url.searchParams.get("organizationId") || undefined,
      fxStatus: url.searchParams.get("fxStatus") || undefined,
      marginStatus: url.searchParams.get("marginStatus") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
    });
    await auditAdminFxAccess(admin.emailAddresses[0]?.emailAddress, "FX_MARGINS_LIST", {
      page: data.page,
      total: data.total,
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
