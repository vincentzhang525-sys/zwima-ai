import { NextResponse } from "next/server";
import { hashApiKey } from "@/lib/credits";
import { resolveApiKey, validateApiKeyState } from "@/lib/api-keys/governance";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!apiKey) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "API key required" } }, { status: 401 });

  const key = await resolveApiKey(hashApiKey(apiKey));
  if (!key) return NextResponse.json({ error: { code: "INVALID_API_KEY", message: "Invalid API key" } }, { status: 401 });
  validateApiKeyState(key);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  const logs = await prisma.aiAuditLog.findMany({
    where: { organizationId: key.organizationId ?? undefined, apiKeyId: key.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      requestId: true,
      status: true,
      selectedProvider: true,
      selectedModel: true,
      inputTokens: true,
      outputTokens: true,
      customerCharge: true,
      fallbackCount: true,
      routingReason: true,
      createdAt: true,
      retentionUntil: true,
    },
  });

  return NextResponse.json({ audit: logs });
}
