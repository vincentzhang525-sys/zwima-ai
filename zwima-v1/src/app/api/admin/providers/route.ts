import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getCurrentDbUser } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const { refreshDailyCounters, getAllProviderRuntime } = await import("@/lib/providers/router");
    refreshDailyCounters();

    const dbProviders = await prisma.provider.findMany({ orderBy: { slug: "asc" } });
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [usageToday, usageStats] = await Promise.all([
      prisma.usageLog.groupBy({
        by: ["providerId"],
        where: { createdAt: { gte: startOfDay } },
        _count: { id: true },
        _sum: { costCredits: true, providerCost: true },
        _avg: { latencyMs: true },
      }),
      prisma.usageLog.groupBy({
        by: ["providerId"],
        where: { createdAt: { gte: startOfDay } },
        _count: { id: true },
      }),
    ]);

    const errorCounts = await prisma.usageLog.groupBy({
      by: ["providerId"],
      where: { createdAt: { gte: startOfDay }, success: false },
      _count: { id: true },
    });

    const usageMap = Object.fromEntries(usageToday.map((u) => [u.providerId, u]));
    const errorMap = Object.fromEntries(errorCounts.map((e) => [e.providerId, e._count.id]));
    const statsMap = Object.fromEntries(usageStats.map((s) => [s.providerId, s._count.id]));

    const runtime = getAllProviderRuntime();
    const runtimeMap = Object.fromEntries(runtime.map((r) => [r.slug, r]));

    const providers = dbProviders.map((p) => {
      const usage = usageMap[p.id];
      const requests = usage?._count.id ?? statsMap[p.id] ?? 0;
      const errors = errorMap[p.id] ?? 0;
      const dailyCost = Number(usage?._sum.providerCost ?? 0);
      const dailyRevenue = (usage?._sum.costCredits ?? 0) / 1000;
      const margin = dailyRevenue > 0 ? Math.round(((dailyRevenue - dailyCost) / dailyRevenue) * 1000) / 10 : 0;

      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        enabled: p.enabled,
        weight: p.weight,
        priority: p.priority,
        status: runtimeMap[p.slug]?.lastHealth?.status ?? (p.lastError ? "error" : "ok"),
        latencyMs: p.lastLatency ?? runtimeMap[p.slug]?.lastLatencyMs,
        lastError: p.lastError ?? runtimeMap[p.slug]?.lastError,
        lastHealthAt: p.lastHealthAt?.toISOString() ?? null,
        usageToday: requests,
        errorRate: requests ? Math.round((errors / requests) * 1000) / 10 : 0,
        dailyCost,
        dailyRevenue,
        margin,
      };
    });

    return NextResponse.json({ providers });
  } catch (err) {
    const status = err instanceof Error && err.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unauthorized" }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const user = await getCurrentDbUser();
    const body = await req.json();
    const { slug, enabled, weight, priority } = body;

    const updated = await prisma.provider.update({
      where: { slug },
      data: {
        ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
        ...(weight !== undefined ? { weight: Number(weight) } : {}),
        ...(priority !== undefined ? { priority: Number(priority) } : {}),
      },
    });

    await writeAudit({
      userId: user?.id,
      action: `Updated provider ${slug}`,
      category: "PROVIDER",
      detail: { enabled, weight, priority },
    });

    return NextResponse.json({ provider: updated });
  } catch (err) {
    const status = err instanceof Error && err.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unauthorized" }, { status });
  }
}
