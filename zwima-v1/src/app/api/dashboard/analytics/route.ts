import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { getAnalytics, type DateRange } from "@/lib/analytics";

export async function GET(req: Request) {
  try {
    const user = await requireDbUser();
    const range = (new URL(req.url).searchParams.get("range") || "7d") as DateRange;
    const valid: DateRange[] = ["today", "7d", "30d", "90d"];
    const r = valid.includes(range) ? range : "7d";
    const data = await getAnalytics(user.id, r);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
