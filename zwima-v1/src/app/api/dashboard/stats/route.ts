import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { getDashboardStats } from "@/lib/analytics";

export async function GET() {
  try {
    const user = await requireDbUser();
    const stats = await getDashboardStats(user.id);
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
