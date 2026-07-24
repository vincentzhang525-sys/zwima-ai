import { gatewayStream, RoutingError } from "@/core/api";
import { validateV1ApiKey } from "@/core/api/auth";
import { errorResponse } from "@/lib/api-errors";
import { generateRequestId } from "@/lib/request-id";

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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of gatewayStream(
            {
              model: body.model ? String(body.model) : undefined,
              provider: body.provider,
              messages,
              maxTokens: body.maxTokens ?? body.max_tokens,
              temperature: body.temperature,
              region: body.region,
              requireEuCompliance: body.requireEuCompliance ?? body.eu,
              organizationId: keyContext?.organizationId,
              monthlyBudgetUsd: keyContext?.monthlyBudgetUsd ?? null,
            },
            requestId,
          )) {
            const payload = {
              requestId: event.requestId,
              delta: event.chunk.delta,
              done: event.chunk.done,
              provider: event.routing.provider,
              model: event.routing.model,
              usage: event.chunk.usage,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            if (event.chunk.done) break;
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Stream failed";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "x-request-id": requestId,
      },
    });
  } catch (err) {
    if (err instanceof RoutingError) {
      return Response.json(
        { error: { code: "ROUTING_FAILED", message: err.message, requestId } },
        { status: err.status },
      );
    }
    return errorResponse(err instanceof Error ? err : new Error("Request failed"), requestId);
  }
}
