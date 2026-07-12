import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { getAuditLogs } from "@/lib/audit";
import type { AuditCategory } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const user = await requireDbUser();
    const url = new URL(req.url);
    const category = url.searchParams.get("category") as AuditCategory | null;
    const logs = await getAuditLogs({ userId: user.id, limit: 100, category: category ?? undefined });
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
