import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getRoutingOverview } from "@/lib/admin/routing-admin-service";

export async function GET() {
  try {
    await requireAdmin();
    const overview = await getRoutingOverview();
    return NextResponse.json(overview);
  } catch (err) {
    const status = err instanceof Error && err.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unauthorized" }, { status });
  }
}
