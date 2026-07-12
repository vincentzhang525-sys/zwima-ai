import type { AIProvider, ChatRequest, ChatResponse } from "./types";

function createStubProvider(slug: string, name: string, models: string[]): AIProvider {
  return {
    slug,
    name,
    async listModels() {
      return models;
    },
    async isAvailable() {
      return true;
    },
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const inputTokens = request.messages.reduce((n, m) => n + Math.ceil(m.content.length / 4), 0);
      const outputTokens = Math.min(request.maxTokens ?? 256, 128);
      return {
        content: `[${name}] Phase 2 stub — provider integration in next phase.`,
        inputTokens,
        outputTokens,
        model: request.model,
        provider: slug,
      };
    },
  };
}

const PROVIDERS: Record<string, AIProvider> = {
  openai: createStubProvider("openai", "OpenAI", ["gpt-4o", "gpt-4.1"]),
  gemini: createStubProvider("gemini", "Gemini", ["gemini-2-flash", "gemini-2-pro"]),
  deepseek: createStubProvider("deepseek", "DeepSeek", ["deepseek-chat"]),
  qwen: createStubProvider("qwen", "Qwen", ["qwen-max"]),
  claude: createStubProvider("claude", "Claude", ["claude-sonnet-4"]),
};

export function getProvider(slug: string): AIProvider | null {
  return PROVIDERS[slug] ?? null;
}

export function listProviders(): AIProvider[] {
  return Object.values(PROVIDERS);
}

export async function routeRequest(model: string): Promise<{ provider: AIProvider; model: string } | null> {
  const normalized = model.toLowerCase();
  for (const provider of listProviders()) {
    const models = await provider.listModels();
    const match = models.find((m) => m.toLowerCase() === normalized);
    if (match) return { provider, model: match };
  }
  if (normalized.startsWith("gpt")) return { provider: PROVIDERS.openai, model };
  if (normalized.startsWith("gemini")) return { provider: PROVIDERS.gemini, model };
  if (normalized.startsWith("deepseek")) return { provider: PROVIDERS.deepseek, model };
  if (normalized.startsWith("qwen")) return { provider: PROVIDERS.qwen, model };
  if (normalized.startsWith("claude")) return { provider: PROVIDERS.claude, model };
  return null;
}

export { PROVIDERS };
