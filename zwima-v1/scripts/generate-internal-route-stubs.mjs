#!/usr/bin/env node
/**
 * Generate auth-gated stubs for Production internal model/ops routes.
 * In-route SERVICE_ROLE / admin auth only — not public capabilities.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routes = [
  "model-availability/error-rate",
  "model-availability/expire-stale",
  "model-availability/latency",
  "model-availability/maintenance",
  "model-availability/observations",
  "model-availability/provider-outage",
  "model-availability/rate-limit",
  "model-availability/region-restriction",
  "model-discovery/apply-approved",
  "model-discovery/run-scheduled",
  "model-discovery/run/[sourceId]",
  "model-health/aggregate",
  "model-health/detect-incidents",
  "model-health/observations",
  "model-health/observations/batch",
  "model-health/rebuild-aggregates",
  "model-lifecycle/actions/execute",
  "model-lifecycle/readiness/recalculate",
  "model-lifecycle/reports/refresh",
  "model-lifecycle/snapshots/create",
  "provider-sync/execute/[jobId]",
  "provider-sync/plan-approved",
  "provider-sync/retry-failed",
  "provider-sync/run-scheduled",
];

const stub = `import { NextResponse } from "next/server";
import { InternalAuthError, requireInternalServiceRole } from "@/lib/internal-auth";

/**
 * Internal-only Production parity stub.
 * Requires SERVICE_ROLE / admin. Does not call Live Providers or mutate via unauthenticated access.
 */
async function handle(req: Request) {
  try {
    await requireInternalServiceRole(req);
    return NextResponse.json(
      {
        ok: true,
        curated: true,
        message: "Internal route acknowledged on curated baseline (service-role required).",
      },
      { status: 200 },
    );
  } catch (err) {
    const status = err instanceof InternalAuthError ? 403 : 401;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
`;

for (const rel of routes) {
  const file = path.join(root, "src/app/api/internal", rel, "route.ts");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, stub);
  console.log("WRITE", path.relative(root, file));
}
console.log("DONE", routes.length);
