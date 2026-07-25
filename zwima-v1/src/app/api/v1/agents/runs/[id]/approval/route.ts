import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { approveAgentAction, rejectAgentAction } from "@/lib/agents/governance";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ success: false, error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  const org = (user as Record<string, unknown>).ownedOrganizations as { id: string }[] | undefined;
  const orgId = org?.[0]?.id;
  if (!orgId) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  if (body.decision === "reject") {
    const result = await rejectAgentAction(orgId, id, user.id);
    return NextResponse.json({ success: true, data: result });
  }
  const result = await approveAgentAction(orgId, id, user.id);
  return NextResponse.json({ success: true, data: result });
}
