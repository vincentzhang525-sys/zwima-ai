import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { auditAdminFxAccess, listFxRatesAdmin } from "@/lib/fx";

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) throw new Error("Forbidden");
    const url = new URL(req.url);
    const data = await listFxRatesAdmin({
      page: Number(url.searchParams.get("page") || 1),
      pageSize: Number(url.searchParams.get("pageSize") || 20),
      currency: url.searchParams.get("currency") || undefined,
      status: url.searchParams.get("status") || undefined,
    });
    await auditAdminFxAccess(admin.emailAddresses[0]?.emailAddress, "FX_RATES_LIST", {
      page: data.page,
      total: data.total,
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
