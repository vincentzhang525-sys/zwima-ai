import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    stripeClient = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  }
  return stripeClient;
}

export const CREDIT_PACKAGES = [
  { id: "starter", credits: 10000, amountEur: 10, label: "€10 — 10,000 credits" },
  { id: "growth", credits: 50000, amountEur: 45, label: "€45 — 50,000 credits" },
  { id: "scale", credits: 200000, amountEur: 160, label: "€160 — 200,000 credits" },
] as const;

export function getPackage(id: string) {
  return CREDIT_PACKAGES.find((p) => p.id === id) ?? null;
}
