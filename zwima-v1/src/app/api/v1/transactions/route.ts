import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { BillingEngine } from "@/lib/billing";

export async function GET(req: Request) {
  try {
    const user = await requireDbUser();
    const limit = Number(new URL(req.url).searchParams.get("limit") || 50);
    const transactions = await BillingEngine.getTransactions(user.id, limit);
    return NextResponse.json({ transactions });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
