import type { ProviderId } from "@/core/providers/types";
import { bootstrapDefaultProviders } from "@/core/providers";
import { createBridgeAdapter } from "./bridge-adapter";
import type { UnifiedProviderAdapter } from "./types";

const adapters = new Map<ProviderId, UnifiedProviderAdapter>();

export function bootstrapUnifiedAdapters(): UnifiedProviderAdapter[] {
  bootstrapDefaultProviders();
  const ids: ProviderId[] = ["openai", "gemini", "claude", "deepseek", "qwen"];
  adapters.clear();
  for (const id of ids) {
    adapters.set(id, createBridgeAdapter(id));
  }
  return [...adapters.values()];
}

export function getUnifiedAdapter(id: ProviderId): UnifiedProviderAdapter | undefined {
  return adapters.get(id);
}

export function requireUnifiedAdapter(id: ProviderId): UnifiedProviderAdapter {
  const adapter = adapters.get(id);
  if (!adapter) throw new Error(`Unified adapter not registered: ${id}`);
  return adapter;
}

export function listUnifiedAdapters(): UnifiedProviderAdapter[] {
  return [...adapters.values()];
}

export function clearUnifiedAdapters(): void {
  adapters.clear();
}

export type { UnifiedProviderAdapter } from "./types";
export { BridgeProviderAdapter, createBridgeAdapter } from "./bridge-adapter";
