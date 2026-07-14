import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();
    const policies = await prisma.routingPolicy.findMany({ orderBy: { createdAt: "desc" } });
    const weights = await prisma.routingWeightConfig.findFirst({ where: { name: "default" } });
    return NextResponse.json({ policies, weights });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const policy = await prisma.routingPolicy.create({
      data: {
        organizationId: body.organizationId ?? null,
        name: String(body.name),
        strategy: body.strategy ?? "BALANCED",
        status: body.status ?? "ACTIVE",
        allowedProviders: body.allowedProviders ?? [],
        blockedProviders: body.blockedProviders ?? [],
        allowedModels: body.allowedModels ?? [],
        blockedModels: body.blockedModels ?? [],
        requiredRegion: body.requiredRegion,
        maximumLatencyMs: body.maximumLatencyMs,
        maximumCostPerRequest: body.maximumCostPerRequest,
        fallbackEnabled: body.fallbackEnabled ?? true,
        maxRetries: body.maxRetries ?? 2,
      },
    });
    return NextResponse.json({ policy });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 403 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    if (body.weights) {
      await prisma.routingWeightConfig.upsert({
        where: { name: "default" },
        create: { name: "default", ...body.weights },
        update: body.weights,
      });
    }
    if (body.policyId && body.policy) {
      await prisma.routingPolicy.update({ where: { id: body.policyId }, data: body.policy });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 403 });
  }
}
