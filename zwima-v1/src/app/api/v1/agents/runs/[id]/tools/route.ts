import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentDbUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ success: false, error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  const { id } = await params;
  const tools = await prisma.agentToolExecution.findMany({
    where: { agentRunId: id },
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json({ success: true, data: tools });
}
