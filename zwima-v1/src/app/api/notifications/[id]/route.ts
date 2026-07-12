import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { markNotificationRead } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: Params) {
  try {
    const user = await requireDbUser();
    const { id } = await params;
    await markNotificationRead(user.id, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
