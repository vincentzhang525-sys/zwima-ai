import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getOpsDashboardData } from "@/lib/admin/ops-dashboard-service";

export async function GET() {
  try {
    await requireAdmin();
    const data = await getOpsDashboardData();
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof Error && err.message === "Forbidden" ? 403 : 401;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status },
    );
  }
}
