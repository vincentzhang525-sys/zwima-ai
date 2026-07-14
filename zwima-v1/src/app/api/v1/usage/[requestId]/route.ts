import { NextResponse } from "next/server";
import { hashApiKey } from "@/lib/credits";
import { resolveApiKey, validateApiKeyState } from "@/lib/api-keys/governance";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ requestId: string }> };

export async function GET(req: Request, { params }: Params) {
  const authHeader = req.headers.get("authorization") || "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!apiKey) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "API key required" } }, { status: 401 });

  const key = await resolveApiKey(hashApiKey(apiKey));
  if (!key) return NextResponse.json({ error: { code: "INVALID_API_KEY", message: "Invalid API key" } }, { status: 401 });
  validateApiKeyState(key);

  const { requestId } = await params;
  const log = await prisma.aiAuditLog.findFirst({
    where: { requestId, organizationId: key.organizationId ?? undefined },
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
      latencyMs: true,
      createdAt: true,
    },
  });

  if (!log) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Request not found" } }, { status: 404 });
  return NextResponse.json({ usage: log });
}
