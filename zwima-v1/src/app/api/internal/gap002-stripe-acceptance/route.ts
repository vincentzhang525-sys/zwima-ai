import { NextResponse } from "next/server";
import {
  authorizeGap002Smoke,
  runGap002LiveLedgerReadOnly,
} from "@/lib/billing/gap002-stripe-acceptance";
import { stripeModeDiagnostic } from "@/lib/stripe-mode-gate";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Mode + classification only (no DB mutations). */
export async function GET(req: Request) {
  if (!authorizeGap002Smoke(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    stripe: stripeModeDiagnostic(process.env),
    acceptanceMode: "READ_ONLY_LIVE_LEDGER",
  });
}

/** Read-only GAP-002 ledger acceptance against existing €10 Live payment evidence. */
export async function POST(req: Request) {
  if (!authorizeGap002Smoke(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const report = await runGap002LiveLedgerReadOnly();
    return NextResponse.json(report, { status: report.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        mode: "READ_ONLY_LIVE_LEDGER",
        error: err instanceof Error ? err.message.slice(0, 300) : "gap002_failed",
        realEmailSent: false,
        newChargeAttempted: false,
      },
      { status: 500 },
    );
  }
}
