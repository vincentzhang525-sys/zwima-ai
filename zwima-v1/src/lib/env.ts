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

  // Warn on placeholder Clerk in production (non-fatal for API-only paths)
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  if (isProd && pk.includes("placeholder")) {
    console.warn("[env] Clerk placeholder keys detected in production");
  }
}
