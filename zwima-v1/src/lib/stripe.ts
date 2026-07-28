import Stripe from "stripe";
import { prisma } from "./prisma";
import { assertStripePaymentsAllowed } from "./stripe-preview-guard";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    stripeClient = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  }
  return stripeClient;
}

export async function listCreditPackages() {
  return prisma.creditPackage.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getCreditPackage(id: string) {
  return prisma.creditPackage.findFirst({ where: { id, enabled: true } });
}

export async function createCheckoutSession(params: {
  userId: string;
  email: string;
  packageId: string;
  couponCode?: string;
}) {
  assertStripePaymentsAllowed();

  const pkg = await getCreditPackage(params.packageId);
  if (!pkg) throw new Error("Invalid package");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const amountEur = Number(pkg.amountEur);
  let bonusCredits = 0;

  if (params.couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: params.couponCode.toUpperCase(), enabled: true },
    });
    if (coupon && (!coupon.expiresAt || coupon.expiresAt > new Date())) {
      bonusCredits = Math.round(Number(pkg.credits) * (Number(coupon.discountPct) / 100));
    }
  }

  const totalCredits = pkg.credits + bonusCredits;

  if (!process.env.STRIPE_SECRET_KEY) {
    return { mock: true as const, pkg, totalCredits, amountEur };
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: params.email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: Math.round(amountEur * 100),
          product_data: { name: `ZWIMA AI Credits — ${totalCredits.toLocaleString()}` },
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/dashboard/billing?success=1`,
    cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
    metadata: {
      userId: params.userId,
      credits: String(totalCredits),
      packageId: pkg.id,
      couponCode: params.couponCode ?? "",
    },
  });

  return { mock: false as const, session, pkg, totalCredits, amountEur };
}
