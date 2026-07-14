import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";
import { BillingEngine } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { StripePreviewDisabledError, assertStripePaymentsAllowed, stripePreviewDisabledPayload } from "@/lib/stripe-preview-guard";

export async function POST(req: Request) {
  try {
    assertStripePaymentsAllowed();
    const user = await requireDbUser();
    const body = await req.json();
    const packageId = String(body.packageId || "");
    const couponCode = body.couponCode ? String(body.couponCode) : undefined;

    const result = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      packageId,
      couponCode,
    });

    if (!result.pkg) return NextResponse.json({ error: "Invalid package" }, { status: 400 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (result.mock) {
      const payment = await prisma.payment.create({
        data: {
          userId: user.id,
          amountEur: result.amountEur,
          credits: result.totalCredits,
          status: "PENDING",
          packageId: result.pkg.id,
          couponCode,
        },
      });
      const recharge = await BillingEngine.recharge({
        userId: user.id,
        credits: result.totalCredits,
        amountEur: result.amountEur,
        description: `Recharge ${result.pkg.label}`,
        paymentId: payment.id,
        couponCode,
      });
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "COMPLETED" } });
      return NextResponse.json({
        ok: true,
        mock: true,
        url: `${appUrl}/dashboard/billing?success=1`,
        invoiceNumber: recharge.invoiceNumber,
      });
    }

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        stripeSessionId: result.session!.id,
        amountEur: result.amountEur,
        credits: result.totalCredits,
        status: "PENDING",
        packageId: result.pkg.id,
        couponCode,
      },
    });

    return NextResponse.json({ url: result.session!.url, paymentId: payment.id });
  } catch (err) {
    if (err instanceof StripePreviewDisabledError) {
      return NextResponse.json(stripePreviewDisabledPayload(), { status: 403 });
    }
    console.error("[billing/checkout]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 500 });
  }
}
