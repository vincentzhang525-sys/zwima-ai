import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireDbUser();
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const provider = url.searchParams.get("provider") || "";
    const model = url.searchParams.get("model") || "";
    const apiKeyId = url.searchParams.get("apiKeyId") || "";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.min(Number(url.searchParams.get("limit") || 200), 500);
    const exportCsv = url.searchParams.get("export") === "csv";

    const providers = provider ? await prisma.provider.findMany({ where: { slug: provider } }) : [];
    const providerIds = providers.map((p) => p.id);

    const logs = await prisma.usageLog.findMany({
      where: {
        userId: user.id,
        ...(providerIds.length ? { providerId: { in: providerIds } } : {}),
        ...(model ? { model: { contains: model, mode: "insensitive" } } : {}),
        ...(apiKeyId ? { apiKeyId } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { model: { contains: q, mode: "insensitive" } },
                { errorMessage: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { provider: true, apiKey: { select: { name: true, prefix: true } } },
      orderBy: { createdAt: "desc" },
      take: exportCsv ? 5000 : limit,
    });

    if (exportCsv) {
      const header = "Time,Provider,Model,Input Tokens,Output Tokens,Cost,Latency,Success,API Key\n";
      const rows = logs
        .map((l) =>
          [
            l.createdAt.toISOString(),
            l.provider.name,
            l.model,
            l.inputTokens,
            l.outputTokens,
            l.costCredits,
            l.latencyMs ?? "",
            l.success,
            l.apiKey?.name ?? "",
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
        )
        .join("\n");

      return new NextResponse(header + rows, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="usage-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        time: l.createdAt.toISOString(),
        provider: l.provider.name,
        providerSlug: l.provider.slug,
        model: l.model,
        inputTokens: l.inputTokens,
        outputTokens: l.outputTokens,
        cost: l.costCredits,
        latencyMs: l.latencyMs,
        success: l.success,
        errorMessage: l.errorMessage,
        apiKey: l.apiKey?.name ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  // CSV export via POST body filters (legacy)
  return GET(req);
}
