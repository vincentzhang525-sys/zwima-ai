import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getCurrentDbUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { upsertPricingRecordV2 } from "@/lib/cost/cost-calculator-v2";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const providerModelId = searchParams.get("providerModelId");
    const where = providerModelId ? { providerModelId } : {};
    const records = await prisma.modelPricingRecord.findMany({
      where,
      include: { providerModel: { include: { provider: true } } },
      orderBy: { effectiveFrom: "desc" },
    });
    return NextResponse.json({ records });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const user = await getCurrentDbUser();
    const body = await req.json();
    const record = await upsertPricingRecordV2({
      ...body,
      verifiedBy: body.pricingStatus === "VERIFIED" ? user?.id ?? null : null,
    });
    return NextResponse.json({ record });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const user = await getCurrentDbUser();
    const body = await req.json();
    const { id, pricingStatus, ...rest } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const record = await prisma.modelPricingRecord.update({
      where: { id },
      data: {
        ...rest,
        ...(pricingStatus
          ? {
              pricingStatus,
              verifiedAt: pricingStatus === "VERIFIED" ? new Date() : null,
              verifiedBy: pricingStatus === "VERIFIED" ? user?.id ?? null : null,
            }
          : {}),
        ...(rest.promotionEndDate !== undefined
          ? { promotionEndDate: rest.promotionEndDate ? new Date(rest.promotionEndDate) : null }
          : {}),
        ...(rest.effectiveFrom !== undefined
          ? { effectiveFrom: new Date(rest.effectiveFrom) }
          : {}),
        ...(rest.effectiveUntil !== undefined
          ? { effectiveUntil: rest.effectiveUntil ? new Date(rest.effectiveUntil) : null }
          : {}),
      },
      include: { providerModel: { include: { provider: true } } },
    });

    await writeAudit({
      userId: user?.id,
      action: `Updated pricing record ${id}`,
      category: "ADMIN",
      detail: { pricingStatus },
    });

    return NextResponse.json({ record });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
