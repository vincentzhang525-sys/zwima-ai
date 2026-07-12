import { NextResponse } from "next/server";
import { BillingEngine } from "@/lib/billing";

export async function GET() {
  const pricing = await BillingEngine.pricing.list();
  const margins = await BillingEngine.margin.list();
  return NextResponse.json({ pricing, margins });
}
