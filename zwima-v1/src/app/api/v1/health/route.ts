import { NextResponse } from "next/server";
import { checkAllProvidersHealth, getProviderRuntime } from "@/lib/providers/router";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const health = await checkAllProvidersHealth();

  await Promise.all(
    Object.keys(health).map(async (slug) => {
      const runtime = getProviderRuntime(slug);
      await prisma.provider.updateMany({
        where: { slug },
        data: {
          lastError: runtime.lastError,
          lastLatency: runtime.lastLatencyMs,
          lastHealthAt: runtime.lastCheckedAt ?? new Date(),
        },
      });
    })
  );

  return NextResponse.json(health);
}
