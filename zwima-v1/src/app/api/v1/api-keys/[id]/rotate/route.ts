import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { rotateOrgApiKey } from "@/lib/api-keys/service";
import { generateRequestId } from "@/lib/request-id";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const requestId = generateRequestId();
  try {
    const user = await requireDbUser();
    const { id } = await params;
    const result = await rotateOrgApiKey(user.id, user.email, id);
    return NextResponse.json({ requestId, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INVALID_API_KEY", message: err instanceof Error ? err.message : "Failed", requestId } },
      { status: 404 }
    );
  }
}
