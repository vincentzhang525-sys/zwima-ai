/**
 * Clerk instance isolation gate (GAP-003).
 *
 * Classifies publishable/secret keys by prefix only — never logs key bodies.
 * Fail-closed rules:
 *   VERCEL_ENV=production  → must use Production (pk_live_ / sk_live_), not Dev/placeholder
 *   VERCEL_ENV=preview     → must use Development (pk_test_ / sk_test_), not live/placeholder
 */

export const CLERK_INSTANCE_MISMATCH = "CLERK_INSTANCE_MISMATCH" as const;

export type ClerkKeyKind = "live" | "test" | "placeholder" | "missing" | "invalid";

export type ClerkInstanceType = "production" | "development" | "placeholder" | "unknown" | "mismatch";

export type ClerkInstanceGateEnv = {
  VERCEL_ENV?: string | undefined;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string | undefined;
  CLERK_SECRET_KEY?: string | undefined;
  [key: string]: string | undefined;
};

export class ClerkInstanceMismatchError extends Error {
  readonly code = CLERK_INSTANCE_MISMATCH;

  constructor(message: string) {
    super(message);
    this.name = "ClerkInstanceMismatchError";
  }
}

function normalizeKey(raw: string | undefined): string {
  return (raw ?? "").trim();
}

/** Classify a Clerk key by prefix / placeholder markers only. */
export function classifyClerkKey(raw: string | undefined, role: "publishable" | "secret"): ClerkKeyKind {
  const key = normalizeKey(raw);
  if (!key) return "missing";
  if (/placeholder/i.test(key)) return "placeholder";

  if (role === "publishable") {
    if (key.startsWith("pk_live_")) return "live";
    if (key.startsWith("pk_test_")) return "test";
    if (key.startsWith("pk_")) return "invalid";
    return "invalid";
  }

  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_")) return "invalid";
  return "invalid";
}

export function classifyClerkInstance(env: ClerkInstanceGateEnv = process.env as ClerkInstanceGateEnv): {
  publishableKind: ClerkKeyKind;
  secretKind: ClerkKeyKind;
  instanceType: ClerkInstanceType;
  configured: boolean;
} {
  const publishableKind = classifyClerkKey(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, "publishable");
  const secretKind = classifyClerkKey(env.CLERK_SECRET_KEY, "secret");

  const configured =
    (publishableKind === "live" || publishableKind === "test") &&
    (secretKind === "live" || secretKind === "test");

  let instanceType: ClerkInstanceType = "unknown";
  if (publishableKind === "placeholder" || secretKind === "placeholder") {
    instanceType = "placeholder";
  } else if (publishableKind === "live" && secretKind === "live") {
    instanceType = "production";
  } else if (publishableKind === "test" && secretKind === "test") {
    instanceType = "development";
  } else if (
    publishableKind !== "missing" &&
    secretKind !== "missing" &&
    publishableKind !== secretKind
  ) {
    instanceType = "mismatch";
  } else {
    instanceType = "unknown";
  }

  return { publishableKind, secretKind, instanceType, configured };
}

/**
 * Returns null when the Clerk instance matches the deployment environment.
 * Returns a stable reason code when isolation is violated.
 */
export function clerkInstanceIsolationViolation(
  env: ClerkInstanceGateEnv = process.env as ClerkInstanceGateEnv,
): string | null {
  const vercelEnv = (env.VERCEL_ENV ?? "").toLowerCase();
  const { publishableKind, secretKind, instanceType } = classifyClerkInstance(env);

  if (vercelEnv === "production") {
    if (instanceType === "placeholder") return "production_requires_live_clerk_not_placeholder";
    if (publishableKind === "test" || secretKind === "test") return "production_must_not_use_development_clerk";
    if (publishableKind === "missing" || secretKind === "missing") return "production_clerk_keys_missing";
    if (instanceType === "mismatch") return "production_clerk_key_pair_mismatch";
    if (instanceType !== "production") return "production_requires_live_clerk";
    return null;
  }

  if (vercelEnv === "preview") {
    if (instanceType === "placeholder") return "preview_requires_development_clerk_not_placeholder";
    if (publishableKind === "live" || secretKind === "live") return "preview_must_not_use_production_clerk";
    if (publishableKind === "missing" || secretKind === "missing") return "preview_clerk_keys_missing";
    if (instanceType === "mismatch") return "preview_clerk_key_pair_mismatch";
    if (instanceType !== "development") return "preview_requires_development_clerk";
    return null;
  }

  // Local / unknown VERCEL_ENV: only reject mixed live+test pairs and placeholders when both set.
  if (instanceType === "mismatch") return "clerk_key_pair_mismatch";
  if (instanceType === "placeholder") return "clerk_placeholder_keys";
  return null;
}

export function isClerkInstanceIsolated(
  env: ClerkInstanceGateEnv = process.env as ClerkInstanceGateEnv,
): boolean {
  return clerkInstanceIsolationViolation(env) === null;
}

/** Fail-closed for production + preview deployments. */
export function assertClerkInstanceIsolated(
  env: ClerkInstanceGateEnv = process.env as ClerkInstanceGateEnv,
): void {
  const violation = clerkInstanceIsolationViolation(env);
  if (violation) {
    throw new ClerkInstanceMismatchError(`${CLERK_INSTANCE_MISMATCH}: ${violation}`);
  }
}

/** Safe diagnostic payload — never includes key material. */
export function clerkInstanceDiagnostic(
  env: ClerkInstanceGateEnv = process.env as ClerkInstanceGateEnv,
) {
  const classified = classifyClerkInstance(env);
  const isolationViolation = clerkInstanceIsolationViolation(env);
  return {
    vercelEnv: env.VERCEL_ENV ?? null,
    publishableKind: classified.publishableKind,
    secretKind: classified.secretKind,
    clerkInstanceType: classified.instanceType,
    clerkConfigured: classified.configured,
    isolated: isolationViolation === null,
    isolationViolation,
  };
}
