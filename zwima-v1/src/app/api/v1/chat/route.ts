import { NextResponse } from "next/server";
import { ChatError, executeChatRequest } from "@/lib/chat-service";
import type { ChatMessage } from "@/lib/providers/types";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();

    const body = await req.json();
    const model = String(body.model || "gemini-2.5-flash");
    const messages: ChatMessage[] = Array.isArray(body.messages)
      ? body.messages
      : [{ role: "user", content: String(body.prompt || "") }];

    const result = await executeChatRequest({
      apiKeyRaw: apiKey,
      model,
      messages,
      maxTokens: body.maxTokens ?? body.max_tokens,
      temperature: body.temperature,
    });

    return NextResponse.json({
      content: result.content,
      model: result.model,
      provider: result.provider,
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costCredits: result.costCredits,
        latencyMs: result.latencyMs,
      },
    });
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/v1/chat]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Request failed" }, { status: 500 });
  }
}
