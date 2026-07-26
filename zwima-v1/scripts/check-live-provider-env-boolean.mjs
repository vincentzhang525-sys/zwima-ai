#!/usr/bin/env node
/**
 * Read-only: confirm LIVE_PROVIDER_CALLS_ENABLED exact boolean on Production.
 * Never prints the raw value or any other env contents.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zwima-live-provider-check-"));
const envFile = path.join(tmp, ".env.production.local");

try {
  execSync(
    "npx vercel env pull .env.production.local --environment production --project zwima-ai --scope zwima --yes",
    { cwd: tmp, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
  );
  const raw = fs.readFileSync(envFile, "utf8");
  let found = false;
  let exact = "UNKNOWN";
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("LIVE_PROVIDER_CALLS_ENABLED=")) continue;
    found = true;
    let v = line.slice("LIVE_PROVIDER_CALLS_ENABLED=".length).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (v === "true") exact = "TRUE";
    else if (v === "false") exact = "FALSE";
    else exact = "NON_BOOLEAN";
    break;
  }
  console.log(
    JSON.stringify({
      LIVE_PROVIDER_ENV_EXISTS: found ? "YES" : "NO",
      LIVE_PROVIDER_ENV_PRODUCTION_ASSIGNED: found ? "YES" : "NO",
      LIVE_PROVIDER_ENV_BOOLEAN_CONFIRMED: exact,
      MATCHES_GATE_TRUE: exact === "TRUE",
      MATCHES_GATE_FALSE: exact === "FALSE",
    }),
  );
} finally {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
