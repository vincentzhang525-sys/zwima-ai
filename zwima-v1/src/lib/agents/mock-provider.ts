/**
 * M8 Agent Platform — Mock model provider.
 *
 * Deterministic, purely local synthetic text generation. No network calls
 * are made, and no real OpenAI/Anthropic/etc. SDKs are imported here. This
 * is the only "model" the agent execution engine is allowed to call.
 */

export type MockChatRole = "system" | "user" | "assistant" | "tool";

export type MockChatMessage = {
  role: MockChatRole;
  content: string;
};

export type MockChatCompletionInput = {
  model?: string;
  systemPrompt?: string | null;
  messages: MockChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Optional stable seed (e.g. a runId) — does not change output shape, only present for traceability. */
  seed?: string;
};

export type MockChatCompletionResult = {
  text: string;
  model: string;
  finishReason: "stop" | "length";
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

export const DEFAULT_MOCK_MODEL = "mock-standard-v1";

/** Very rough, deterministic token estimate (~4 chars/token) — good enough for a mock provider's synthetic accounting. */
export function estimateMockTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

function buildPromptText(input: MockChatCompletionInput): string {
  const parts: string[] = [];
  if (input.systemPrompt) parts.push(input.systemPrompt);
  for (const message of input.messages) parts.push(message.content);
  return parts.join("\n");
}

function lastUserMessage(messages: MockChatMessage[]): MockChatMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") return messages[i];
  }
  return undefined;
}

/**
 * Synthesizes a deterministic "completion" with no external calls. The text
 * simply acknowledges and echoes a snippet of the last user message so
 * downstream code (execution engine, tests) has something non-trivial to
 * work with, while staying obviously synthetic.
 */
export async function mockChatCompletion(
  input: MockChatCompletionInput,
): Promise<MockChatCompletionResult> {
  const model = input.model?.trim() || DEFAULT_MOCK_MODEL;
  const promptText = buildPromptText(input);
  const inputTokens = estimateMockTokens(promptText);
  const maxTokens = Math.max(16, Math.floor(input.maxTokens ?? 512));

  const lastUser = lastUserMessage(input.messages);
  const summary = (lastUser?.content ?? "").trim().slice(0, 240);

  const text = summary
    ? `[MOCK] Synthetic response from ${model} — acknowledged: "${summary}". No live model was called; this content is generated for testing/demo purposes only.`
    : `[MOCK] Synthetic response from ${model} — no user content was provided. No live model was called; this content is generated for testing/demo purposes only.`;

  const fullOutputTokens = estimateMockTokens(text);
  const truncated = fullOutputTokens > maxTokens;
  const outputText = truncated ? `${text.slice(0, maxTokens * 4)}…` : text;
  const outputTokens = Math.min(fullOutputTokens, maxTokens);

  return {
    text: outputText,
    model,
    finishReason: truncated ? "length" : "stop",
    inputTokens,
    outputTokens,
    latencyMs: 5 + (promptText.length % 50),
  };
}

/**
 * Synthetic per-token cost estimate for mock runs. These rates are
 * illustrative only — they never touch M4 billing/cost-engine and must
 * never be presented to a user as real pricing.
 */
export function estimateMockCost(inputTokens: number, outputTokens: number): number {
  const inputRatePerToken = 0.0000005;
  const outputRatePerToken = 0.0000015;
  const cost = inputTokens * inputRatePerToken + outputTokens * outputRatePerToken;
  return Number(cost.toFixed(6));
}
