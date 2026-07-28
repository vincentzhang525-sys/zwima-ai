/**
 * Stripe mode isolation gate (GAP-002).
 * Closed Beta requires Stripe Test Mode (sk_test_ / pk_test_).
 * Never logs key bodies — prefix classification only.
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

export function isClosedBetaStripeTestOnly(
  env: StripeModeGateEnv = process.env as StripeModeGateEnv,
): boolean {
  const flag = env.CLOSED_BETA_STRIPE_TEST_ONLY;
  // Default ON for Closed Beta safety when unset.
  if (flag == null || flag === "") return true;
  return flag === "true";
}

export function stripeModeDiagnostic(env: StripeModeGateEnv = process.env as StripeModeGateEnv) {
  const secretKind = classifyStripeKey(env.STRIPE_SECRET_KEY, "secret");
  const publishableKind = classifyStripeKey(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, "publishable");
  const testOnly = isClosedBetaStripeTestOnly(env);
  const secretOk = secretKind === "test";
  const publishableOk = publishableKind === "test" || publishableKind === "missing";
  const hasLive = secretKind === "live" || publishableKind === "live";
  const isolated = !testOnly || (secretOk && publishableOk && !hasLive);

  return {
    vercelEnv: env.VERCEL_ENV ?? null,
    secretKind,
    publishableKind,
    closedBetaStripeTestOnly: testOnly,
    isolated,
  };
}

export function assertStripeTestModeForClosedBeta(
  env: StripeModeGateEnv = process.env as StripeModeGateEnv,
): void {
  if (!isClosedBetaStripeTestOnly(env)) return;

  const secretKind = classifyStripeKey(env.STRIPE_SECRET_KEY, "secret");
  const publishableKind = classifyStripeKey(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, "publishable");

  if (secretKind === "live" || publishableKind === "live") {
    throw new StripeModeMismatchError(
      `${STRIPE_MODE_MISMATCH}: Closed Beta requires Stripe Test Mode (sk_test_/pk_test_)`,
    );
  }
  if (secretKind === "placeholder" || publishableKind === "placeholder") {
    throw new StripeModeMismatchError(`${STRIPE_MODE_MISMATCH}: Stripe placeholder keys are not allowed`);
  }
  if (secretKind === "missing") {
    throw new StripeModeMismatchError(`${STRIPE_MODE_MISMATCH}: STRIPE_SECRET_KEY missing`);
  }
  if (secretKind !== "test") {
    throw new StripeModeMismatchError(`${STRIPE_MODE_MISMATCH}: STRIPE_SECRET_KEY must be sk_test_`);
  }
  if (publishableKind !== "missing" && publishableKind !== "test") {
    throw new StripeModeMismatchError(
      `${STRIPE_MODE_MISMATCH}: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be pk_test_`,
    );
  }
}
