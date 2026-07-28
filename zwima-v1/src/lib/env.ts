import {
  assertClerkInstanceIsolated,
  clerkInstanceIsolationViolation,
} from "@/lib/auth/clerk-instance-gate";

type EnvCheck = { key: string; required: boolean; secret?: boolean };

const CHECKS: EnvCheck[] = [
  { key: "DATABASE_URL", required: true, secret: true },
  { key: "STRIPE_SECRET_KEY", required: false, secret: true },
  { key: "STRIPE_WEBHOOK_SECRET", required: false, secret: true },
  { key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", required: false },
  { key: "CLERK_SECRET_KEY", required: false, secret: true },
];

export type PlatformEnv = {
  minMarginPercent: number;
  maxProviderRetries: number;
  maxEstimatedOutputTokens: number;
  defaultRoutingStrategy: string;
  routingEngine: "policy" | "legacy" | "smart";
};

function numEnv(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function getPlatformEnv(): PlatformEnv {
  return {
    minMarginPercent: numEnv("MIN_MARGIN_PERCENT", 10),
    maxProviderRetries: numEnv("MAX_PROVIDER_RETRIES", 2),
    maxEstimatedOutputTokens: numEnv("MAX_ESTIMATED_OUTPUT_TOKENS", 16384),
    defaultRoutingStrategy: process.env.DEFAULT_ROUTING_STRATEGY ?? "BALANCED",
    routingEngine:
      process.env.ROUTING_ENGINE === "smart"
        ? "smart"
        : process.env.ROUTING_ENGINE === "policy"
          ? "policy"
          : "legacy",
  };
}

let validated = false;

/** Fail closed in production when critical env is missing. */
export function validateEnvAtStartup(): void {
  if (validated) return;
  validated = true;

  const isProd = process.env.NODE_ENV === "production";
  const missing: string[] = [];

  for (const c of CHECKS) {
    if (c.required && !process.env[c.key]) missing.push(c.key);
  }

  if (isProd && missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  // GAP-003: fail-closed Clerk instance isolation on Vercel production/preview.
  const vercelEnv = (process.env.VERCEL_ENV ?? "").toLowerCase();
  if (vercelEnv === "production" || vercelEnv === "preview") {
    assertClerkInstanceIsolated(process.env);
  } else if (isProd) {
    // Non-Vercel production-like hosts: keep legacy placeholder warning.
    const violation = clerkInstanceIsolationViolation({
      ...process.env,
      VERCEL_ENV: "production",
    });
    if (violation) {
      console.warn(`[env] Clerk instance isolation warning: ${violation}`);
    }
  }
}
