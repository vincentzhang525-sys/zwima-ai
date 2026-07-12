import { prisma } from "../prisma";
import type { SubscriptionPlan } from "@prisma/client";
import { getStripe } from "../stripe";
import { processRecharge } from "./credits-engine";

export async function createSubscriptionCheckout(params: {
  userId: string;
  email: string;
  plan: SubscriptionPlan;
  amountEur: number;
  creditsPerPeriod: number;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!process.env.STRIPE_SECRET_KEY) {
    const sub = await prisma.subscription.create({
      data: {
        userId: params.userId,
        plan: params.plan,
        status: "ACTIVE",
        amountEur: params.amountEur,
        creditsPerPeriod: params.creditsPerPeriod,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await processRecharge({
      userId: params.userId,
      credits: params.creditsPerPeriod,
      amountEur: params.amountEur,
      description: `Subscription ${params.plan}`,
    });
    return { url: `${appUrl}/dashboard/billing?subscription=1`, subscriptionId: sub.id };
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: params.email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: Math.round(params.amountEur * 100),
          recurring: { interval: params.plan === "YEARLY" ? "year" : "month" },
          product_data: { name: `ZWIMA AI ${params.plan} Plan` },
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/dashboard/billing?subscription=success`,
    cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
    metadata: {
      userId: params.userId,
      plan: params.plan,
      creditsPerPeriod: String(params.creditsPerPeriod),
    },
  });

  await prisma.subscription.create({
    data: {
      userId: params.userId,
      plan: params.plan,
      status: "ACTIVE",
      amountEur: params.amountEur,
      creditsPerPeriod: params.creditsPerPeriod,
    },
  });

  return { url: session.url, sessionId: session.id };
}

export async function handleSubscriptionRenewal(stripeSubscriptionId: string, userId: string, credits: number) {
  const sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId } });
  if (!sub) return null;

  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    },
  });

  return processRecharge({
    userId,
    credits,
    amountEur: Number(sub.amountEur ?? 0),
    description: `Subscription renewal ${sub.plan}`,
  });
}

export async function cancelSubscription(userId: string, subscriptionId: string) {
  const sub = await prisma.subscription.findFirst({ where: { id: subscriptionId, userId } });
  if (!sub) throw new Error("Subscription not found");

  if (sub.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
  }

  return prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "CANCELED" },
  });
}

export async function listUserSubscriptions(userId: string) {
  return prisma.subscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function listAllSubscriptions() {
  return prisma.subscription.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}
