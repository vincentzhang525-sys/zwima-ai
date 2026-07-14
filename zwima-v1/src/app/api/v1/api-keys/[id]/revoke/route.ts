import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { revokeOrgApiKey } from "@/lib/api-keys/service";
import { generateRequestId } from "@/lib/request-id";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const requestId = generateRequestId();
  try {
    const user = await requireDbUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    await revokeOrgApiKey(user.id, user.email, id, String(body.reason ?? "Revoked"));
    return NextResponse.json({ requestId, ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "API_KEY_REVOKED", message: err instanceof Error ? err.message : "Failed", requestId } },
      { status: 404 }
    );
  }
}
