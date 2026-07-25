/**
 * Curated read-only ops health helpers (no Live Provider HTTP, no DB writes).
 * Mirrors Production `/api/health*` response shape without M11 infrastructure deps.
 */
import { prisma } from "@/lib/prisma";

export type HealthLevel = "healthy" | "degraded" | "unhealthy";

function worst(a: HealthLevel, b: HealthLevel): HealthLevel {
  const rank = { healthy: 0, degraded: 1, unhealthy: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

function envLabel(): string {
  const v = (process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown").toUpperCase();
  return v === "PRODUCTION" ? "PRODUCTION" : v === "PREVIEW" ? "PREVIEW" : v;
}

function liveProviderFlagDisplay(): string {
  const raw = process.env.LIVE_PROVIDER_CALLS_ENABLED;
  if (raw === undefined) return "LIVE_PROVIDER_CALLS_ENABLED=(missing)";
  return `LIVE_PROVIDER_CALLS_ENABLED=${raw === "true" ? "true" : raw === "false" ? "false" : "(non-boolean)"}`;
}

export function getLiveHealth() {
  return {
    status: "healthy" as HealthLevel,
    check: "live",
    timestamp: new Date().toISOString(),
    environment: envLabel(),
  };
}

export async function getReadyHealth() {
  const checks: { name: string; status: HealthLevel; detail?: string }[] = [];
  const started = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: "database", status: "healthy" });
  } catch {
    checks.push({ name: "database", status: "unhealthy", detail: "db_unreachable" });
  }

  const clerkOk =
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) &&
    Boolean(process.env.CLERK_SECRET_KEY?.trim());
  checks.push({ name: "clerk", status: clerkOk ? "healthy" : "unhealthy" });

  // Never probe providers here — report flag state only.
  checks.push({
    name: "live_provider_disabled",
    status: process.env.LIVE_PROVIDER_CALLS_ENABLED === "true" ? "degraded" : "healthy",
    detail: liveProviderFlagDisplay(),
  });

  let status: HealthLevel = "healthy";
  for (const c of checks) status = worst(status, c.status);

  return {
    status,
    check: "ready",
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - started,
    environment: envLabel(),
    liveProviderCallsEnabled: process.env.LIVE_PROVIDER_CALLS_ENABLED === "true",
    liveProviderFlagDisplay: liveProviderFlagDisplay(),
    checks,
  };
}

export async function getCompositeHealth(opts?: { limited?: boolean }) {
  const live = getLiveHealth();
  const ready = await getReadyHealth();
  const limited = opts?.limited ?? envLabel() === "PRODUCTION";

  const body: Record<string, unknown> = {
    status: worst(live.status, ready.status),
    timestamp: new Date().toISOString(),
    environment: ready.environment,
    live: { status: live.status },
    ready: {
      status: ready.status,
      liveProviderFlagDisplay: ready.liveProviderFlagDisplay,
    },
  };

  if (!limited) {
    body.ready = {
      status: ready.status,
      latencyMs: ready.latencyMs,
      liveProviderFlagDisplay: ready.liveProviderFlagDisplay,
      checks: ready.checks,
    };
  }

  return body;
}
