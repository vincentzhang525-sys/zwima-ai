import { NextResponse } from "next/server";
import { gatewayChat, RoutingError } from "@/core/api";
import { ApiError, errorResponse } from "@/lib/api-errors";
import { generateRequestId } from "@/lib/request-id";
import { validateV1ApiKey } from "@/core/api/auth";
import { persistV1ChatUsage } from "@/lib/billing/v1-chat-usage";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? generateRequestId();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
    const keyContext = await validateV1ApiKey(apiKey, requestId);

    const body = await req.json();
    const messages = Array.isArray(body.messages)
      ? body.messages
      : [{ role: "user" as const, content: String(body.prompt || "") }];

    const result = await gatewayChat(
      {
        model: body.model ? String(body.model) : undefined,
        provider: body.provider,
        messages,
        maxTokens: body.maxTokens ?? body.max_tokens,
        temperature: body.temperature,
        region: body.region,
        requireEuCompliance: body.requireEuCompliance ?? body.eu,
        organizationId: keyContext.organizationId,
        monthlyBudgetUsd: keyContext.monthlyBudgetUsd ?? null,
      },
      requestId,
    );

    const workspace = await prisma.enterpriseWorkspace.findFirst({
      where: { organizationId: keyContext.organizationId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    const providerReportedUsage = result.inputTokens > 0 || result.outputTokens > 0;

    const billed = await persistV1ChatUsage({
      key: {
        userId: keyContext.userId,
        apiKeyId: keyContext.apiKeyId,
        organizationId: keyContext.organizationId,
        userTier: keyContext.userTier,
      },
      requestId: result.requestId || requestId,
      providerSlug: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      messages,
      providerReportedUsage,
      workspaceId: workspace?.id ?? null,
    });

    return NextResponse.json(
      {
        requestId: result.requestId,
        content: result.content,
        model: result.model,
        provider: result.provider,
        routing: result.routing,
        usage: {
          inputTokens: billed.inputTokens,
          outputTokens: billed.outputTokens,
          totalTokens: billed.totalTokens,
          latencyMs: result.latencyMs,
          costUsd: result.cost.totalCostUsd,
          costCredits: billed.costCredits,
          usageLogId: billed.usageLogId,
          usageSource: billed.usageSource,
          replayed: billed.replayed,
        },
      },
      {
        headers: {
          "x-zwima-provider": result.provider,
          "x-zwima-model": result.model,
          "x-zwima-routing-score": String(result.routing.score),
          "x-zwima-failover-count": String(result.routing.failoverCount),
          "x-zwima-usage-log-id": billed.usageLogId,
          "x-zwima-usage-source": billed.usageSource,
        },
      },
    );
  } catch (err) {
    if (err instanceof RoutingError) {
      return NextResponse.json(
        { error: { code: "ROUTING_FAILED", message: err.message, requestId } },
        { status: err.status },
      );
    }
    if (err instanceof ApiError) {
      return errorResponse(err, requestId);
    }
    return errorResponse(err instanceof Error ? err : new Error("Request failed"), requestId);
  }
}
