import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { createOrgApiKey, listOrgApiKeys } from "@/lib/api-keys/service";
import { generateRequestId } from "@/lib/request-id";

export async function GET() {
  const requestId = generateRequestId();
  try {
    const user = await requireDbUser();
    const { keys } = await listOrgApiKeys(user.id, user.email);
    return NextResponse.json({ requestId, keys });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: err instanceof Error ? err.message : "Unauthorized", requestId } },
      { status: 401 }
    );
  }
}

export async function POST(req: Request) {
  const requestId = generateRequestId();
  try {
    const user = await requireDbUser();
    const body = await req.json();
    const result = await createOrgApiKey(user.id, user.email, body);
    return NextResponse.json({ requestId, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: err instanceof Error ? err.message : "Failed", requestId } },
      { status: 400 }
    );
  }
}
