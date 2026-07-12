import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();
    const { refreshDailyCounters, getAllProviderRuntime } = await import("@/lib/providers/router");
    refreshDailyCounters();

    const dbProviders = await prisma.provider.findMany({ orderBy: { slug: "asc" } });
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const usageToday = await prisma.usageLog.groupBy({
      by: ["providerId"],
      where: { createdAt: { gte: startOfDay } },
      _count: { id: true },
    });
    const usageMap = Object.fromEntries(usageToday.map((u) => [u.providerId, u._count.id]));

    const runtime = getAllProviderRuntime();
    const runtimeMap = Object.fromEntries(runtime.map((r) => [r.slug, r]));

    const providers = dbProviders.map((p) => ({
      slug: p.slug,
      name: p.name,
      enabled: p.enabled,
      status: runtimeMap[p.slug]?.lastHealth?.status ?? (p.lastError ? "error" : "ok"),
      latencyMs: p.lastLatency ?? runtimeMap[p.slug]?.lastLatencyMs,
      lastError: p.lastError ?? runtimeMap[p.slug]?.lastError,
      lastHealthAt: p.lastHealthAt?.toISOString() ?? null,
      usageToday: usageMap[p.id] ?? runtimeMap[p.slug]?.usageToday ?? 0,
    }));

    return NextResponse.json({ providers });
  } catch (err) {
    const status = err instanceof Error && err.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unauthorized" }, { status });
  }
}
