import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
    const organizationId = searchParams.get("organizationId");

    const logs = await prisma.aiAuditLog.findMany({
      where: organizationId ? { organizationId } : {},
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        requestId: true,
        organizationId: true,
        selectedProvider: true,
        selectedModel: true,
        status: true,
        inputTokens: true,
        outputTokens: true,
        customerCharge: true,
        margin: true,
        fallbackCount: true,
        routingReason: true,
        errorCode: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
