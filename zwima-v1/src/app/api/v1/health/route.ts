import { NextResponse } from "next/server";
import { checkAllProvidersHealth, getAllAdapters } from "@/lib/providers/router";
import { isLiveProviderHttpAllowed } from "@/lib/providers/live-provider-gate";

/**
 * Provider health — read-only.
 * - Never persists health results to the database.
 * - Preview / fail-closed Live Provider: configuration-only status (no outbound calls).
 * - Production with live calls enabled: may probe providers without writing.
 */
export async function GET() {
  if (!isLiveProviderHttpAllowed()) {
    const health: Record<string, string> = {};
    for (const adapter of getAllAdapters()) {
      health[adapter.slug] = "blocked";
    }
    return NextResponse.json(health);
  }

  const health = await checkAllProvidersHealth();
  return NextResponse.json(health);
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
