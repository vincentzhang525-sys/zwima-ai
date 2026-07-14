import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { updateOrgApiKey, revokeOrgApiKey } from "@/lib/api-keys/service";
import { generateRequestId } from "@/lib/request-id";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const requestId = generateRequestId();
  try {
    const user = await requireDbUser();
    const { id } = await params;
    const body = await req.json();
    const key = await updateOrgApiKey(user.id, user.email, id, body);
    return NextResponse.json({ requestId, key });
  } catch (err) {
    const status = err instanceof Error && err.message === "Not found" ? 404 : 400;
    return NextResponse.json(
      { error: { code: status === 404 ? "INVALID_API_KEY" : "VALIDATION_ERROR", message: err instanceof Error ? err.message : "Failed", requestId } },
      { status }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const requestId = generateRequestId();
  try {
    const user = await requireDbUser();
    const { id } = await params;
    await revokeOrgApiKey(user.id, user.email, id, "Revoked via API");
    return NextResponse.json({ requestId, ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INVALID_API_KEY", message: err instanceof Error ? err.message : "Failed", requestId } },
      { status: 404 }
    );
  }
}
