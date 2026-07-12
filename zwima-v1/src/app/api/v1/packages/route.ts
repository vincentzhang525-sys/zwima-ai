import { NextResponse } from "next/server";
import { listCreditPackages } from "@/lib/stripe";

export async function GET() {
  const packages = await listCreditPackages();
  return NextResponse.json({
    packages: packages.map((p) => ({
      id: p.id,
      label: p.label,
      amountEur: String(p.amountEur),
      credits: p.credits,
    })),
  });
}
