import { NextResponse } from "next/server";
import Stripe from "stripe";
import { BillingEngine } from "@/lib/billing";
import { processRefund } from "@/lib/billing/credits-engine";
import { handleSubscriptionRenewal } from "@/lib/billing/subscription-engine";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { isStripePreviewDisabled, stripePreviewDisabledPayload } from "@/lib/stripe-preview-guard";
import {
  assertStripeTestModeForClosedBeta,
  StripeModeMismatchError,
  STRIPE_MODE_MISMATCH,
} from "@/lib/stripe-mode-gate";

export async function POST(req: Request) {
  if (isStripePreviewDisabled()) {
    return NextResponse.json(stripePreviewDisabledPayload(), { status: 403 });
  }

  try {
    assertStripeTestModeForClosedBeta();
  } catch (err) {
    if (err instanceof StripeModeMismatchError) {
      return NextResponse.json(
        { error: { code: STRIPE_MODE_MISMATCH, message: err.message } },
        { status: 403 },
      );
    }
    throw err;
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid signature" }, { status: 400 });
  }

  // Idempotency: skip already-processed Stripe events
  const existing = await prisma.payment.findFirst({ where: { stripeEventId: event.id } });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const credits = Number(session.metadata?.credits || 0);
      const amountEur = (session.amount_total ?? 0) / 100;

      if (userId && credits > 0) {
        const payment = await prisma.payment.findFirst({ where: { stripeSessionId: session.id } });
        if (payment && payment.status !== "COMPLETED") {
          await BillingEngine.recharge({
            userId,
            credits,
            amountEur,
            description: `Stripe checkout ${session.id}`,
            paymentId: payment.id,
            couponCode: session.metadata?.couponCode || undefined,
          });
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "COMPLETED",
              stripePaymentId: session.payment_intent as string,
              stripeEventId: event.id,
            },
          });
        } else if (!payment) {
          const newPayment = await prisma.payment.create({
            data: {
              userId,
              stripeSessionId: session.id,
              stripePaymentId: session.payment_intent as string,
              stripeEventId: event.id,
              amountEur,
              credits,
              status: "COMPLETED",
              packageId: session.metadata?.packageId,
            },
          });
          await BillingEngine.recharge({
            userId,
            credits,
            amountEur,
            description: `Stripe checkout ${session.id}`,
            paymentId: newPayment.id,
          });
        }
      }

      if (session.mode === "subscription" && userId) {
        const creditsPerPeriod = Number(session.metadata?.creditsPerPeriod || 0);
        if (creditsPerPeriod > 0) {
          await handleSubscriptionRenewal(session.subscription as string, userId, creditsPerPeriod);
        }
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId =
        typeof invoice.parent?.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : null;
      if (subId) {
        const sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subId } });
        if (sub?.creditsPerPeriod) {
          await handleSubscriptionRenewal(subId, sub.userId, sub.creditsPerPeriod);
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: { status: "CANCELED" },
      });
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const payment = await prisma.payment.findFirst({ where: { stripePaymentId: charge.payment_intent as string } });
      if (payment && payment.status !== "REFUNDED") {
        await processRefund(payment.userId, payment.credits, Number(payment.amountEur), "Stripe refund");
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
