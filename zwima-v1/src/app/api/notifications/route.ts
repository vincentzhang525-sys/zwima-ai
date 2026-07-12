import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { getNotifications, getUnreadCount, markAllRead } from "@/lib/notifications";

export async function GET() {
  try {
    const user = await requireDbUser();
    const [notifications, unread] = await Promise.all([getNotifications(user.id), getUnreadCount(user.id)]);
    return NextResponse.json({ notifications, unread });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH() {
  try {
    const user = await requireDbUser();
    await markAllRead(user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
