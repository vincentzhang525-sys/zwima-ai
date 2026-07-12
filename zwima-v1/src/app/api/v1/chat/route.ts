import { NextResponse } from "next/server";
import { hashApiKey } from "@/lib/credits";
import { routeRequest } from "@/lib/providers/router";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!apiKey.startsWith("sk_live_")) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const keyHash = hashApiKey(apiKey);
  const key = await prisma.apiKey.findFirst({
    where: { keyHash, enabled: true },
    include: { user: { include: { creditBalance: true } } },
  });

  if (!key) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const balance = key.user.creditBalance?.credits ?? 0;
  if (balance <= 0) return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });

  const body = await req.json();
  const model = String(body.model || "gpt-4o");
  const messages = Array.isArray(body.messages) ? body.messages : [{ role: "user", content: String(body.prompt || "") }];

  const routed = await routeRequest(model);
  if (!routed) return NextResponse.json({ error: "Model not found" }, { status: 404 });

  const providerRow = await prisma.provider.findUnique({ where: { slug: routed.provider.slug } });
  if (!providerRow) return NextResponse.json({ error: "Provider unavailable" }, { status: 503 });

  const result = await routed.provider.chat({ model: routed.model, messages, maxTokens: body.maxTokens });
  const costCredits = Math.max(1, Math.ceil((result.inputTokens + result.outputTokens) / 100));

  if (balance < costCredits) return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });

  await prisma.$transaction(async (tx) => {
    await tx.creditBalance.update({
      where: { userId: key.userId },
      data: { credits: { decrement: costCredits } },
    });
    await tx.usageLog.create({
      data: {
        userId: key.userId,
        apiKeyId: key.id,
        providerId: providerRow.id,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costCredits,
      },
    });
    await tx.transaction.create({
      data: {
        userId: key.userId,
        type: "DEBIT",
        amount: costCredits,
        description: `${result.provider}/${result.model}`,
      },
    });
    await tx.apiKey.update({ where: { id: key.id }, data: { lastUsed: new Date() } });
  });

  return NextResponse.json({
    content: result.content,
    model: result.model,
    provider: result.provider,
    usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, costCredits },
  });
}
