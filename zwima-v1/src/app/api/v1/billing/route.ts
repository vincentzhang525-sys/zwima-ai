import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";
import { createSubscriptionCheckout } from "@/lib/billing/subscription-engine";
import type { SubscriptionPlan } from "@prisma/client";
import { StripePreviewDisabledError, assertStripePaymentsAllowed, stripePreviewDisabledPayload } from "@/lib/stripe-preview-guard";

export async function POST(req: Request) {
  try {
    assertStripePaymentsAllowed();
    const user = await requireDbUser();
    const body = await req.json();
    const action = body.action || "checkout";

    if (action === "subscription") {
      const plan = String(body.plan || "MONTHLY").toUpperCase() as SubscriptionPlan;
      const amountEur = Number(body.amountEur || 29);
      const creditsPerPeriod = Number(body.creditsPerPeriod || 20000);
      const result = await createSubscriptionCheckout({
        userId: user.id,
        email: user.email,
        plan,
        amountEur,
        creditsPerPeriod,
      });
      return NextResponse.json(result);
    }

    const packageId = String(body.packageId || "");
    const couponCode = body.couponCode ? String(body.couponCode) : undefined;
    const result = await createCheckoutSession({ userId: user.id, email: user.email, packageId, couponCode });
    if (!result.pkg) return NextResponse.json({ error: "Invalid package" }, { status: 400 });

    if (result.mock) {
      return NextResponse.json({ mock: true, package: result.pkg, credits: result.totalCredits });
    }

    return NextResponse.json({ checkoutUrl: result.session!.url, credits: result.totalCredits });
  } catch (err) {
    if (err instanceof StripePreviewDisabledError) {
      return NextResponse.json(stripePreviewDisabledPayload(), { status: 403 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Billing failed" }, { status: 500 });
  }
}
