import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { auditAdminFxAccess, listFxPoliciesAdmin } from "@/lib/fx";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) throw new Error("Forbidden");
    const data = await listFxPoliciesAdmin();
    await auditAdminFxAccess(admin.emailAddresses[0]?.emailAddress, "FX_POLICIES_LIST", {
      count: data.items.length,
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
