import type { ProviderAdapter } from "./types";
import { openaiAdapter } from "./openai";
import { geminiAdapter } from "./gemini";
import { deepseekAdapter } from "./deepseek";
import { qwenAdapter } from "./qwen";
import { claudeAdapter } from "./claude";

/** Adapter registry — add new providers here only; business layer stays unchanged. */
const ADAPTERS: ProviderAdapter[] = [
  geminiAdapter,
  openaiAdapter,
  deepseekAdapter,
  qwenAdapter,
  claudeAdapter,
];

const bySlug = new Map<string, ProviderAdapter>(ADAPTERS.map((a) => [a.slug, a]));

export function getAdapter(slug: string): ProviderAdapter | undefined {
  return bySlug.get(slug);
}

export function getAllAdapters(): ProviderAdapter[] {
  return ADAPTERS;
}

export function registerAdapter(adapter: ProviderAdapter): void {
  bySlug.set(adapter.slug, adapter);
  if (!ADAPTERS.find((a) => a.slug === adapter.slug)) {
    ADAPTERS.push(adapter);
  }
}
