import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";
import { BillingEngine } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

/** Enterprise recharge API */
export async function POST(req: Request) {
  try {
    const user = await requireDbUser();
    const body = await req.json();
    const packageId = String(body.packageId || body.package || "");
    const couponCode = body.couponCode ? String(body.couponCode) : undefined;

    if (!packageId) return NextResponse.json({ error: "packageId required" }, { status: 400 });

    const result = await createCheckoutSession({ userId: user.id, email: user.email, packageId, couponCode });
    if (!result.pkg) return NextResponse.json({ error: "Invalid package" }, { status: 400 });

    if (result.mock) {
      const payment = await prisma.payment.create({
        data: { userId: user.id, amountEur: result.amountEur, credits: result.totalCredits, status: "PENDING", packageId, couponCode },
      });
      const recharge = await BillingEngine.recharge({
        userId: user.id,
        credits: result.totalCredits,
        amountEur: result.amountEur,
        paymentId: payment.id,
        couponCode,
      });
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "COMPLETED" } });
      return NextResponse.json({ ok: true, credits: result.totalCredits, invoiceNumber: recharge.invoiceNumber });
    }

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        stripeSessionId: result.session!.id,
        amountEur: result.amountEur,
        credits: result.totalCredits,
        status: "PENDING",
        packageId,
        couponCode,
      },
    });

    return NextResponse.json({ checkoutUrl: result.session!.url, paymentId: payment.id, credits: result.totalCredits });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Recharge failed" }, { status: 500 });
  }
}
