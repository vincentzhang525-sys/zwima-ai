import type { ChatMessage } from "./types";

export function extractSystemMessage(messages: ChatMessage[]): {
  system: string | undefined;
  chatMessages: ChatMessage[];
} {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const chatMessages = messages.filter((m) => m.role !== "system");
  return {
    system: systemParts.length ? systemParts.join("\n") : undefined,
    chatMessages,
  };
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ data: T; latencyMs: number; status: number }> {
  const { timeoutMs = 60000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    const latencyMs = Date.now() - start;
    const data = (await res.json()) as T;
    return { data, latencyMs, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

export function openAiCompatibleChat(
  baseUrl: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ data: OpenAiChatResponse; latencyMs: number; status: number }> {
  return fetchJson<OpenAiChatResponse>(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

type OpenAiChatResponse = {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string };
};

export function parseOpenAiResponse(
  data: OpenAiChatResponse,
  model: string,
  provider: string,
  latencyMs: number
) {
  if (data.error?.message) throw new Error(data.error.message);
  const content = data.choices?.[0]?.message?.content ?? "";
  return {
    content,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    model,
    provider,
    latencyMs,
  };
}
