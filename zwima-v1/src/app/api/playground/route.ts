import { requireDbUser } from "@/lib/auth";
import { chargeForUsage, estimateRequestCredits } from "@/lib/billing/credits-engine";
import { checkLowBalance } from "@/lib/notifications";
import { routeByModel, recordProviderSuccess, recordProviderError } from "@/lib/providers/router";
import { getAdapter } from "@/lib/providers/registry";
import { prisma } from "@/lib/prisma";
import type { ChatMessage } from "@/lib/providers/types";

export async function POST(req: Request) {
  try {
    const user = await requireDbUser();
    const body = await req.json();
    const model = String(body.model || "gemini-2.5-flash");
    const providerSlug = body.provider ? String(body.provider) : undefined;
    const messages: ChatMessage[] = [{ role: "user", content: String(body.prompt || "") }];
    const stream = body.stream !== false;

    const wallet = await prisma.creditBalance.findUnique({ where: { userId: user.id } });
    const available = (wallet?.credits ?? 0) - (wallet?.frozenCredits ?? 0);

    let routed = null;
    if (providerSlug) {
      const adapter = getAdapter(providerSlug);
      if (adapter) {
        const match =
          adapter.models().find((m) => m.id === model) ??
          adapter.models().find((m) => m.id.toLowerCase() === model.toLowerCase());
        if (match) routed = { adapter, model: match.id };
      }
    }
    if (!routed) routed = await routeByModel(model);
    if (!routed) return new Response(JSON.stringify({ error: "Model not found" }), { status: 404 });

    const providerRow = await prisma.provider.findUnique({ where: { slug: routed.adapter.slug } });
    if (!providerRow?.enabled) return new Response(JSON.stringify({ error: "Provider unavailable" }), { status: 503 });

    const estimate = await estimateRequestCredits(messages, routed.adapter.slug, routed.model, 1024, {
      userId: user.id,
      userTier: user.tier,
      providerSlug: routed.adapter.slug,
      modelId: routed.model,
    });
    if (available < estimate.customerCredits) {
      return new Response(JSON.stringify({ error: "Insufficient credits" }), { status: 402 });
    }

    let playgroundKey = await prisma.apiKey.findFirst({ where: { userId: user.id, name: "__playground__" } });
    if (!playgroundKey) {
      const { generateApiKey } = await import("@/lib/credits");
      const { fullKey, prefix, keyHash } = generateApiKey();
      void fullKey;
      playgroundKey = await prisma.apiKey.create({
        data: { userId: user.id, name: "__playground__", prefix, keyHash, permission: "CHAT" },
      });
    }

    const start = Date.now();
    let result;
    try {
      result = await routed.adapter.chat({ model: routed.model, messages, maxTokens: 1024 });
      recordProviderSuccess(routed.adapter.slug, result.latencyMs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Provider request failed";
      recordProviderError(routed.adapter.slug, msg);
      return new Response(JSON.stringify({ error: msg }), { status: 502 });
    }

    const { costCredits } = await chargeForUsage({
      userId: user.id,
      apiKeyId: playgroundKey.id,
      providerId: providerRow.id,
      providerSlug: routed.adapter.slug,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      userTier: user.tier,
    });

    const balance = await prisma.creditBalance.findUnique({ where: { userId: user.id } });
    if (balance) await checkLowBalance(user.id, balance.credits);

    const meta = {
      model: result.model,
      provider: result.provider,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costCredits,
      latencyMs: result.latencyMs || Date.now() - start,
    };

    if (!stream) {
      return Response.json({ content: result.content, ...meta });
    }

    const encoder = new TextEncoder();
    const words = result.content.split(/(\s+)/);
    const readable = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "meta", ...meta })}\n\n`));
        for (const word of words) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", content: word })}\n\n`));
          await new Promise((r) => setTimeout(r, 15));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Failed" }), { status: 500 });
  }
}
