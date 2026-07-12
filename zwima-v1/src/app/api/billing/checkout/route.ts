import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { addCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { getPackage, getStripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const user = await requireDbUser();
    const { packageId } = await req.json();
    const pkg = getPackage(String(packageId || ""));
    if (!pkg) return NextResponse.json({ error: "Invalid package" }, { status: 400 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!process.env.STRIPE_SECRET_KEY) {
      const payment = await prisma.payment.create({
        data: {
          userId: user.id,
          amountEur: pkg.amountEur,
          credits: pkg.credits,
          status: "COMPLETED",
        },
      });
      await addCredits(user.id, pkg.credits, `Mock checkout ${payment.id}`);
      return NextResponse.json({ url: `${appUrl}/dashboard/billing?success=1&mock=1` });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: Math.round(pkg.amountEur * 100),
            product_data: { name: `ZWIMA AI Credits — ${pkg.credits.toLocaleString()}` },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard/billing?success=1`,
      cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
      metadata: { userId: user.id, credits: String(pkg.credits), packageId: pkg.id },
    });

    await prisma.payment.create({
      data: {
        userId: user.id,
        stripeSessionId: session.id,
        amountEur: pkg.amountEur,
        credits: pkg.credits,
        status: "PENDING",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing/checkout]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 500 });
  }
}
