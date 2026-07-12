import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { BillingEngine } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ pricing: await BillingEngine.pricing.list() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Forbidden" }, { status: 403 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const row = await BillingEngine.pricing.upsert({
      providerSlug: body.providerSlug,
      modelId: body.modelId,
      inputTokenCost: Number(body.inputTokenCost),
      outputTokenCost: Number(body.outputTokenCost),
      marginPercent: body.marginPercent != null ? Number(body.marginPercent) : undefined,
    });
    return NextResponse.json({ pricing: row });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    if (body.type === "package") {
      const pkg = await prisma.creditPackage.create({
        data: {
          label: body.label,
          amountEur: body.amountEur,
          credits: body.credits,
          sortOrder: body.sortOrder ?? 99,
        },
      });
      return NextResponse.json({ package: pkg });
    }
    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
