import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createProvider,
  deleteProviderBySlug,
  formatProviderForAdmin,
  listProvidersAdmin,
  setProviderApiKeys,
  updateProviderBySlug,
} from "@/lib/providers/provider-admin-service";

async function withUsageMetrics() {
  const dbProviders = await listProvidersAdmin();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [usageToday, errorCounts] = await Promise.all([
    prisma.usageLog.groupBy({
      by: ["providerId"],
      where: { createdAt: { gte: startOfDay } },
      _count: { id: true },
      _sum: { costCredits: true, providerCost: true },
    }),
    prisma.usageLog.groupBy({
      by: ["providerId"],
      where: { createdAt: { gte: startOfDay }, success: false },
      _count: { id: true },
    }),
  ]);

  const usageMap = Object.fromEntries(usageToday.map((u) => [u.providerId, u]));
  const errorMap = Object.fromEntries(errorCounts.map((e) => [e.providerId, e._count.id]));

  return dbProviders.map((p) => {
    const base = formatProviderForAdmin(p);
    const usage = usageMap[p.id];
    const requests = usage?._count.id ?? 0;
    const errors = errorMap[p.id] ?? 0;
    const dailyCost = Number(usage?._sum.providerCost ?? 0);
    const dailyRevenue = (usage?._sum.costCredits ?? 0) / 1000;
    const margin =
      dailyRevenue > 0 ? Math.round(((dailyRevenue - dailyCost) / dailyRevenue) * 1000) / 10 : 0;

    return {
      ...base,
      usageToday: requests,
      errorRate: requests ? Math.round((errors / requests) * 1000) / 10 : 0,
      dailyCost,
      dailyRevenue,
      margin,
    };
  });
}

export async function GET() {
  try {
    await requireAdmin();
    const providers = await withUsageMetrics();
    return NextResponse.json({ providers });
  } catch (err) {
    const status = err instanceof Error && err.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unauthorized" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const user = await getCurrentDbUser();
    const body = await req.json();
    const { action, slug, ...data } = body;

    if (action === "setApiKeys") {
      if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
      const provider = await setProviderApiKeys(slug, data.keys || []);
      await writeAudit({
        userId: user?.id,
        action: `Rotated API keys for ${slug}`,
        category: "PROVIDER",
        detail: { keyCount: (data.keys || []).length },
      });
      return NextResponse.json({ provider: formatProviderForAdmin(provider) });
    }

    if (!slug || !data.name) {
      return NextResponse.json({ error: "slug and name required" }, { status: 400 });
    }

    const provider = await createProvider({
      slug,
      name: data.name,
      enabled: data.enabled,
      status: data.status,
      baseUrl: data.baseUrl,
      region: data.region,
      dataResidency: data.dataResidency,
      weight: data.weight,
      priority: data.priority,
      supportsStreaming: data.supportsStreaming,
      supportsTools: data.supportsTools,
      supportsVision: data.supportsVision,
      config: {
        regions: data.regions,
        capabilities: { embedding: data.supportsEmbedding },
        apiKeys: data.apiKeys,
      },
    });

    await writeAudit({
      userId: user?.id,
      action: `Created provider ${slug}`,
      category: "PROVIDER",
      detail: { slug },
    });

    return NextResponse.json({ provider: formatProviderForAdmin(provider) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const user = await getCurrentDbUser();
    const body = await req.json();
    const {
      slug,
      enabled,
      weight,
      priority,
      name,
      status,
      region,
      dataResidency,
      baseUrl,
      supportsStreaming,
      supportsTools,
      supportsVision,
      supportsEmbedding,
      regions,
      apiKeys,
    } = body;

    if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

    const updated = await updateProviderBySlug(slug, {
      enabled,
      weight,
      priority,
      name,
      status,
      region,
      dataResidency,
      baseUrl,
      supportsStreaming,
      supportsTools,
      supportsVision,
      config: {
        ...(regions !== undefined ? { regions } : {}),
        ...(supportsEmbedding !== undefined
          ? { capabilities: { embedding: Boolean(supportsEmbedding) } }
          : {}),
        ...(apiKeys !== undefined ? { apiKeys } : {}),
      },
    });

    await writeAudit({
      userId: user?.id,
      action: `Updated provider ${slug}`,
      category: "PROVIDER",
      detail: { enabled, weight, priority, name, status, region, dataResidency },
    });

    return NextResponse.json({ provider: formatProviderForAdmin(updated) });
  } catch (err) {
    const status = err instanceof Error && err.message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    const user = await getCurrentDbUser();
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

    await deleteProviderBySlug(slug);
    await writeAudit({
      userId: user?.id,
      action: `Deprecated provider ${slug}`,
      category: "PROVIDER",
      detail: { slug },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
