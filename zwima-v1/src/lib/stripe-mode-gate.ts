/**
 * Stripe mode classification (GAP-002).
 * Closed Beta commercial loop uses existing Live Stripe evidence.
 * Never logs key bodies — prefix classification only.
 *
 * Test-only enforcement is opt-in via CLOSED_BETA_STRIPE_TEST_ONLY=true.
 * Default is OFF so Live Production keys remain operable.
 */

export const STRIPE_MODE_MISMATCH = "STRIPE_MODE_MISMATCH" as const;

export type StripeKeyKind = "test" | "live" | "placeholder" | "missing" | "invalid";

export type StripeModeGateEnv = {
  STRIPE_SECRET_KEY?: string;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
  CLOSED_BETA_STRIPE_TEST_ONLY?: string;
  VERCEL_ENV?: string;
  [key: string]: string | undefined;
};

export class StripeModeMismatchError extends Error {
  readonly code = STRIPE_MODE_MISMATCH;
  readonly status = 403;

  constructor(message: string) {
    super(message);
    this.name = "StripeModeMismatchError";
  }
}

export function classifyStripeKey(raw: string | undefined, role: "secret" | "publishable"): StripeKeyKind {
  const key = (raw ?? "").trim();
  if (!key) return "missing";
  if (/placeholder/i.test(key)) return "placeholder";
  if (role === "secret") {
    if (key.startsWith("sk_test_")) return "test";
    if (key.startsWith("sk_live_")) return "live";
    if (key.startsWith("sk_")) return "invalid";
    return "invalid";
  }
  if (key.startsWith("pk_test_")) return "test";
  if (key.startsWith("pk_live_")) return "live";
  if (key.startsWith("pk_")) return "invalid";
  return "invalid";
}

/** Opt-in only — default false (Live Closed Beta allowed). */
export function isClosedBetaStripeTestOnly(
  env: StripeModeGateEnv = process.env as StripeModeGateEnv,
): boolean {
  return env.CLOSED_BETA_STRIPE_TEST_ONLY === "true";
}

export function stripeModeDiagnostic(env: StripeModeGateEnv = process.env as StripeModeGateEnv) {
  const secretKind = classifyStripeKey(env.STRIPE_SECRET_KEY, "secret");
  const publishableKind = classifyStripeKey(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, "publishable");
  const testOnly = isClosedBetaStripeTestOnly(env);
  const configured = secretKind === "test" || secretKind === "live";
  const pairOk =
    (secretKind === "live" && (publishableKind === "live" || publishableKind === "missing")) ||
    (secretKind === "test" && (publishableKind === "test" || publishableKind === "missing"));

  return {
    vercelEnv: env.VERCEL_ENV ?? null,
    secretKind,
    publishableKind,
    closedBetaStripeTestOnly: testOnly,
    configured,
    pairOk,
    /** Isolated means configured live/test pair (not placeholder). */
    isolated: configured && pairOk,
  };
}

/**
 * Reject placeholder / missing / mismatched pairs.
 * Only when CLOSED_BETA_STRIPE_TEST_ONLY=true, also reject live keys.
 */
export function assertStripeTestModeForClosedBeta(
  env: StripeModeGateEnv = process.env as StripeModeGateEnv,
): void {
  const secretKind = classifyStripeKey(env.STRIPE_SECRET_KEY, "secret");
  const publishableKind = classifyStripeKey(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, "publishable");

  if (secretKind === "placeholder" || publishableKind === "placeholder") {
    throw new StripeModeMismatchError(`${STRIPE_MODE_MISMATCH}: Stripe placeholder keys are not allowed`);
  }
  if (secretKind === "missing") {
    throw new StripeModeMismatchError(`${STRIPE_MODE_MISMATCH}: STRIPE_SECRET_KEY missing`);
  }
  if (secretKind === "invalid" || publishableKind === "invalid") {
    throw new StripeModeMismatchError(`${STRIPE_MODE_MISMATCH}: Stripe key prefix invalid`);
  }
  if (
    publishableKind !== "missing" &&
    ((secretKind === "live" && publishableKind !== "live") ||
      (secretKind === "test" && publishableKind !== "test"))
  ) {
    throw new StripeModeMismatchError(`${STRIPE_MODE_MISMATCH}: Stripe secret/publishable mode mismatch`);
  }

  if (!isClosedBetaStripeTestOnly(env)) return;

  if (secretKind === "live" || publishableKind === "live") {
    throw new StripeModeMismatchError(
      `${STRIPE_MODE_MISMATCH}: CLOSED_BETA_STRIPE_TEST_ONLY requires sk_test_/pk_test_`,
    );
  }
  if (secretKind !== "test") {
    throw new StripeModeMismatchError(`${STRIPE_MODE_MISMATCH}: STRIPE_SECRET_KEY must be sk_test_`);
  }
}
