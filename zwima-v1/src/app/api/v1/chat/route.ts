import { NextResponse } from "next/server";
import { ChatError, executeChatRequest } from "@/lib/chat-service";
import { errorResponse } from "@/lib/api-errors";
import { generateRequestId } from "@/lib/request-id";
import type { ChatMessage } from "@/lib/providers/types";
import {
  buildTransparencyHeaders,
  getComplianceForModel,
  logComplianceAudit,
} from "@/lib/compliance/ai-compliance";

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? generateRequestId();

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
      strategy: body.strategy ?? body.routingPolicy,
      clientRequestId: body.clientRequestId,
      requestId,
    });

    const responseHeaders = new Headers();
    let compliance: Record<string, unknown> | undefined;

    if (result.routingHeaders) {
      for (const [k, v] of Object.entries(result.routingHeaders)) {
        responseHeaders.set(k, v);
      }
    }

    if (result.providerModelId) {
      const profile = await getComplianceForModel(result.providerModelId);
      if (profile) {
        compliance = {
          status: profile.complianceStatus,
          transparencyRequired: profile.transparencyRequired,
          aiGeneratedLabelRequired: profile.aiGeneratedLabelRequired,
          deepfakeDisclosureRequired: profile.deepfakeDisclosureRequired,
          gdpr: profile.gdpr,
        };
        const transparencyHeaders = buildTransparencyHeaders({
          transparencyRequired: profile.transparencyRequired,
          aiGeneratedLabelRequired: profile.aiGeneratedLabelRequired,
          deepfakeDisclosureRequired: profile.deepfakeDisclosureRequired,
          complianceStatus: profile.complianceStatus,
          gdpr: profile.gdpr,
        });
        for (const [key, value] of Object.entries(transparencyHeaders)) {
          responseHeaders.set(key, value);
        }
        if (Object.keys(transparencyHeaders).length > 0) {
          await logComplianceAudit({
            providerModelId: result.providerModelId,
            action: "chat_transparency_headers",
            detail: { requestId: result.requestId, headers: transparencyHeaders },
          });
        }
      }
    }

    return NextResponse.json(
      {
        requestId: result.requestId,
        content: result.content,
        model: result.model,
        provider: result.provider,
        routing: result.routingReason
          ? { reason: result.routingReason, fallbackCount: result.fallbackCount ?? 0 }
          : undefined,
        compliance,
        usage: {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costCredits: result.costCredits,
          latencyMs: result.latencyMs,
        },
      },
      { headers: responseHeaders },
    );
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ ...err.toJSON(), error: { ...err.toJSON().error, requestId } }, { status: err.status });
    }
    return errorResponse(err instanceof Error ? err : new Error("Request failed"), requestId);
  }
}
