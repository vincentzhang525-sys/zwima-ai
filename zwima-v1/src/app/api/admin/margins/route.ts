import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { BillingEngine } from "@/lib/billing";
import type { MarginScope } from "@prisma/client";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ margins: await BillingEngine.margin.list() });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const row = await BillingEngine.margin.upsert({
      scope: body.scope as MarginScope,
      targetId: body.targetId,
      multiplier: Number(body.multiplier),
      label: body.label,
    });
    return NextResponse.json({ margin: row });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
