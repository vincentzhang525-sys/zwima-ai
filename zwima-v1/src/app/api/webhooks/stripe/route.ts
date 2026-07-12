import { NextResponse } from "next/server";
import Stripe from "stripe";
import { addCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!process.env.STRIPE_WEBHOOK_SECRET || !sig) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const credits = Number(session.metadata?.credits || 0);

    if (userId && credits > 0) {
      const payment = await prisma.payment.findFirst({ where: { stripeSessionId: session.id } });
      if (payment && payment.status !== "COMPLETED") {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "COMPLETED", stripePaymentId: session.payment_intent as string },
        });
        await addCredits(userId, credits, `Stripe payment ${session.id}`);
      }
    }
  }

  return NextResponse.json({ received: true });
}
