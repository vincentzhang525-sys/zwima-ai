import { NextResponse } from "next/server";
import {
  authorizeGap002Smoke,
  runGap002StripeAcceptance,
} from "@/lib/billing/gap002-stripe-acceptance";
import { stripeModeDiagnostic } from "@/lib/stripe-mode-gate";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Mode-only probe (no mutations). */
export async function GET(req: Request) {
  if (!authorizeGap002Smoke(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    stripe: stripeModeDiagnostic(process.env),
  });
}

/** Full GAP-002 ledger acceptance (Test Mode only). */
export async function POST(req: Request) {
  if (!authorizeGap002Smoke(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const report = await runGap002StripeAcceptance({ baseUrl: new URL(req.url).origin });
    return NextResponse.json(report, { status: report.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 300) : "gap002_failed",
        realEmailSent: false,
      },
      { status: 500 },
    );
  }
}
