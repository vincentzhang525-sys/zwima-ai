import { NextResponse } from "next/server";
import { bootstrapUnifiedAdapters, listUnifiedAdapters } from "@/core/adapters";
import { gatewayProviders } from "@/core/api";
import { bootstrapDefaultProviders, listProviders } from "@/core/providers";
import {
  isLiveProviderHttpAllowed,
  PROVIDER_LIVE_CALLS_DISABLED,
} from "@/lib/providers/live-provider-gate";

/**
 * Production-compatible provider registry listing.
 * Contract: `{ providers: [{ id, displayName, status, priority, region, euAvailable,
 *   supportedFeatures, defaultModels, adapterRegistered, health }] }`
 *
 * When Live Provider HTTP is fail-closed (Preview / missing flag), returns HTTP 200
 * with explicit blocked/offline health — never 404, never fake online:true, no outbound calls.
 */
function blockedHealth() {
  return {
    online: false,
    latencyMs: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    errorRate: 0,
    quotaRemaining: null,
    status: "OFFLINE" as const,
    message: PROVIDER_LIVE_CALLS_DISABLED,
  };
}

export async function GET() {
  if (!isLiveProviderHttpAllowed()) {
    bootstrapDefaultProviders();
    bootstrapUnifiedAdapters();
    const adapters = listUnifiedAdapters();
    const providers = listProviders().map((provider) => {
      const meta = provider.metadata;
      return {
        id: meta.id,
        displayName: meta.displayName,
        status: "OFFLINE" as const,
        priority: meta.priority,
        region: meta.region,
        euAvailable: meta.euAvailable,
        supportedFeatures: meta.supportedFeatures,
        defaultModels: meta.defaultModels,
        adapterRegistered: adapters.some((a) => a.id === meta.id),
        health: blockedHealth(),
      };
    });
    return NextResponse.json({ providers });
  }

  const providers = await gatewayProviders();
  return NextResponse.json({
    providers: providers.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      status: p.status,
      priority: p.priority,
      region: p.region,
      euAvailable: p.euAvailable,
      supportedFeatures: p.supportedFeatures,
      defaultModels: p.defaultModels,
      adapterRegistered: p.adapterRegistered,
      health: p.metrics ?? p.health,
    })),
  });
}
