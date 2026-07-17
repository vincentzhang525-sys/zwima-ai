import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Production billing usage from PostgreSQL UsageLog (not in-memory meter).
 */
export async function GET(req: Request) {
  try {
    const user = await requireDbUser();
    const url = new URL(req.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

    const logs = await prisma.usageLog.findMany({
      where: { userId: user.id },
      include: {
        provider: { select: { slug: true, name: true } },
        apiKey: { select: { id: true, name: true, prefix: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const aggregateRow = await prisma.usageLog.aggregate({
      where: { userId: user.id },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        costCredits: true,
        providerCost: true,
      },
      _count: { _all: true },
    });

    const byProviderRows = await prisma.usageLog.groupBy({
      by: ["providerId"],
      where: { userId: user.id },
      _sum: { costCredits: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
    });

    const providerIds = byProviderRows.map((r) => r.providerId);
    const providers = await prisma.provider.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, slug: true },
    });
    const providerMap = new Map(providers.map((p) => [p.id, p.slug]));

    const usage = logs.map((l) => ({
      id: l.id,
      requestId: l.requestId,
      provider: l.provider.slug,
      model: l.model,
      inputTokens: l.inputTokens,
      outputTokens: l.outputTokens,
      totalTokens: l.inputTokens + l.outputTokens,
      costCredits: l.costCredits,
      providerCost: l.providerCost ? Number(l.providerCost) : null,
      latencyMs: l.latencyMs,
      success: l.success,
      apiKeyId: l.apiKeyId,
      apiKeyPrefix: l.apiKey?.prefix ?? null,
      createdAt: l.createdAt.toISOString(),
    }));

    return NextResponse.json({
      usage,
      aggregate: {
        requestCount: aggregateRow._count._all,
        totalInputTokens: aggregateRow._sum.inputTokens ?? 0,
        totalOutputTokens: aggregateRow._sum.outputTokens ?? 0,
        totalCredits: aggregateRow._sum.costCredits ?? 0,
        totalProviderCost: Number(aggregateRow._sum.providerCost ?? 0),
      },
      byProvider: byProviderRows.map((r) => ({
        provider: providerMap.get(r.providerId) ?? r.providerId,
        requestCount: r._count._all,
        totalCredits: r._sum.costCredits ?? 0,
        totalInputTokens: r._sum.inputTokens ?? 0,
        totalOutputTokens: r._sum.outputTokens ?? 0,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 401 },
    );
  }
}
