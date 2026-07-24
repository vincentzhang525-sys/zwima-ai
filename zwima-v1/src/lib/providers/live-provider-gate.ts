/**
 * Fail-closed Live Provider HTTP gate.
 *
 * Real provider HTTP is allowed ONLY when BOTH are true:
 *   process.env.VERCEL_ENV === "production"
 *   process.env.LIVE_PROVIDER_CALLS_ENABLED === "true"  (exact lowercase string)
 *
 * Missing env, Preview, Development, Test, or any other flag value → blocked.
 */

export const PROVIDER_LIVE_CALLS_DISABLED = "PROVIDER_LIVE_CALLS_DISABLED";

export class LiveProviderCallsDisabledError extends Error {
  readonly code = PROVIDER_LIVE_CALLS_DISABLED;

  constructor(message = "Live provider HTTP calls are disabled") {
    super(message);
    this.name = "LiveProviderCallsDisabledError";
  }
}

export type LiveProviderGateEnv = {
  VERCEL_ENV?: string | undefined;
  LIVE_PROVIDER_CALLS_ENABLED?: string | undefined;
  [key: string]: string | undefined;
};

function readGateEnv(env: LiveProviderGateEnv): {
  VERCEL_ENV?: string;
  LIVE_PROVIDER_CALLS_ENABLED?: string;
} {
  return {
    VERCEL_ENV: env.VERCEL_ENV,
    LIVE_PROVIDER_CALLS_ENABLED: env.LIVE_PROVIDER_CALLS_ENABLED,
  };
}

/** Pure check — default deny. */
export function isLiveProviderHttpAllowed(env: LiveProviderGateEnv = process.env as LiveProviderGateEnv): boolean {
  const { VERCEL_ENV: vercelEnv, LIVE_PROVIDER_CALLS_ENABLED: flag } = readGateEnv(env);
  return vercelEnv === "production" && flag === "true";
}

/**
 * Assert live provider HTTP may proceed. Throws LiveProviderCallsDisabledError otherwise.
 */
export function assertLiveProviderHttpAllowed(
  env: LiveProviderGateEnv = process.env as LiveProviderGateEnv,
): void {
  if (!isLiveProviderHttpAllowed(env)) {
    throw new LiveProviderCallsDisabledError(
      `${PROVIDER_LIVE_CALLS_DISABLED}: requires VERCEL_ENV=production and LIVE_PROVIDER_CALLS_ENABLED=true (exact)`,
    );
  }
}
