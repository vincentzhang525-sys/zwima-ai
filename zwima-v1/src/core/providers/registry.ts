import type { AIProvider } from "./provider";
import { attachHealthToRegistryEntry, runProviderHealthCheck } from "./health";
import type { ProviderId, ProviderRegistryEntry } from "./types";
import { createClaudeProvider } from "./claude/provider";
import { createDeepSeekProvider } from "./deepseek/provider";
import { createGeminiProvider } from "./gemini/provider";
import { createOpenAIProvider } from "./openai/provider";
import { createQwenProvider } from "./qwen/provider";

const providers = new Map<ProviderId, AIProvider>();

export function registerProvider(provider: AIProvider): void {
  providers.set(provider.id, provider);
}

export function unregisterProvider(id: ProviderId): void {
  providers.delete(id);
}

export function getProvider(id: ProviderId): AIProvider | undefined {
  return providers.get(id);
}

export function requireProvider(id: ProviderId): AIProvider {
  const provider = providers.get(id);
  if (!provider) throw new Error(`Provider not registered: ${id}`);
  return provider;
}

export function listProviders(): AIProvider[] {
  return [...providers.values()].sort((a, b) => b.metadata.priority - a.metadata.priority);
}

export function listProviderIds(): ProviderId[] {
  return listProviders().map((p) => p.id);
}

export async function listProviderRegistryEntries(): Promise<ProviderRegistryEntry[]> {
  const entries: ProviderRegistryEntry[] = [];
  for (const provider of listProviders()) {
    const health = await provider.health();
    entries.push(attachHealthToRegistryEntry(provider.metadata, health));
  }
  return entries;
}

export async function refreshProviderHealth(id: ProviderId): Promise<ProviderRegistryEntry | null> {
  const provider = providers.get(id);
  if (!provider) return null;
  const health = await runProviderHealthCheck(provider);
  return attachHealthToRegistryEntry(provider.metadata, health);
}

export function clearProviderRegistry(): void {
  providers.clear();
}

/** Bootstrap all five Phase 5 foundation providers (stub mode). */
export function bootstrapDefaultProviders(): AIProvider[] {
  const defaults = [
    createGeminiProvider(),
    createOpenAIProvider(),
    createDeepSeekProvider(),
    createQwenProvider(),
    createClaudeProvider(),
  ];
  for (const provider of defaults) registerProvider(provider);
  return defaults;
}

export function providerRegistrySize(): number {
  return providers.size;
}
