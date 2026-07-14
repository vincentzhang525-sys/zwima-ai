import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { estimateCostV2 } from "@/lib/cost/cost-calculator-v2";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const result = await estimateCostV2(body);
    if (!result) {
      return NextResponse.json({ error: "No VERIFIED pricing for model" }, { status: 404 });
    }
    return NextResponse.json({ estimate: result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
