import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getRoutingDecisionById } from "@/lib/admin/routing-admin-service";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const decision = await getRoutingDecisionById(id);
    if (!decision) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(decision);
  } catch (err) {
    const status = err instanceof Error && err.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unauthorized" }, { status });
  }
}
