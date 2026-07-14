import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { listRoutingDecisions } from "@/lib/admin/routing-admin-service";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const sp = new URL(req.url).searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    const data = await listRoutingDecisions({
      limit: Number(sp.get("limit") ?? 50),
      offset: Number(sp.get("offset") ?? 0),
      provider: sp.get("provider") ?? undefined,
      mode: sp.get("mode") ?? undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof Error && err.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unauthorized" }, { status });
  }
}
