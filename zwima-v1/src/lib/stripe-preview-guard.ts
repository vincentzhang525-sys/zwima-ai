/** Preview safety gate — blocks live Stripe when STRIPE_PREVIEW_DISABLED=true. */

export function isStripePreviewDisabled(): boolean {
  return process.env.STRIPE_PREVIEW_DISABLED === "true";
}

export class StripePreviewDisabledError extends Error {
  readonly code = "STRIPE_PREVIEW_DISABLED" as const;
  readonly status = 403;

  constructor(message = "Stripe payments are disabled on this Preview environment.") {
    super(message);
    this.name = "StripePreviewDisabledError";
  }
}

export function assertStripePaymentsAllowed(): void {
  if (isStripePreviewDisabled()) {
    throw new StripePreviewDisabledError();
  }
}

export function stripePreviewDisabledPayload() {
  return {
    error: {
      code: "STRIPE_PREVIEW_DISABLED",
      message:
        "Stripe payments are disabled on this Preview environment. Checkout, subscriptions, and webhooks are not processed.",
    },
    stripePreviewDisabled: true,
  };
}
