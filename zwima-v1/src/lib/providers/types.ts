export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
};

export type ChatResponse = {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string;
};

export interface AIProvider {
  readonly slug: string;
  readonly name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  listModels(): Promise<string[]>;
  isAvailable(): Promise<boolean>;
}

export type ProviderRouteResult = {
  provider: AIProvider;
  model: string;
};
