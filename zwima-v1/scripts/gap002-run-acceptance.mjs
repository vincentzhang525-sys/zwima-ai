#!/usr/bin/env node
/**
 * GAP-002 read-only Live ledger + E2E commercial loop gate (no new charges).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outFile = join(tmpdir(), `zwima-gap002-ro-${Date.now()}.env`);
const baseUrl = (process.env.SMOKE_BASE_URL || "https://zwima-group.info").replace(/\/$/, "");

function parseEnv(text) {
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    map[line.slice(0, eq).trim()] = v;
  }
  return map;
}

function redact(s) {
  return String(s)
    .replace(/sk_[a-zA-Z0-9_-]+/g, "[REDACTED]")
    .replace(/whsec_[a-zA-Z0-9]+/g, "[REDACTED]")
    .replace(/pi_[a-zA-Z0-9]+/g, "pi_[REDACTED]")
    .replace(/cs_[a-zA-Z0-9_]+/g, "cs_[REDACTED]")
    .replace(/evt_[a-zA-Z0-9_]+/g, "evt_[REDACTED]");
}

const pull = spawnSync(
  "npx",
  ["vercel", "env", "pull", outFile, "--environment", "production", "--yes"],
  { encoding: "utf8", shell: true },
);
if (pull.status !== 0) {
  console.log(JSON.stringify({ ok: false, error: "env_pull_failed" }));
  process.exit(1);
}

try {
  const map = parseEnv(readFileSync(outFile, "utf8"));
  const smokeKey = map.SMOKE_TEST_API_KEY || "";
  if (!smokeKey || smokeKey === "[SENSITIVE]") {
    console.log(JSON.stringify({ ok: false, error: "SMOKE_TEST_API_KEY_unavailable" }));
    process.exit(2);
  }

  const modeRes = await fetch(`${baseUrl}/api/internal/gap002-stripe-acceptance`, {
    headers: { Authorization: `Bearer ${smokeKey}` },
  });
  const modeBody = await modeRes.json().catch(() => ({}));

  const acceptRes = await fetch(`${baseUrl}/api/internal/gap002-stripe-acceptance`, {
    method: "POST",
    headers: { Authorization: `Bearer ${smokeKey}`, "Content-Type": "application/json" },
  });
  const acceptBody = await acceptRes.json().catch(() => ({}));

  const providersRes = await fetch(`${baseUrl}/api/v1/providers`);
  const providersBody = await providersRes.json().catch(() => ({}));
  const openai = (providersBody.providers || []).find((p) => p.id === "openai");

  const loginRes = await fetch(`${baseUrl}/login`);
  const loginHtml = await loginRes.text();
  const clerkLive = /pk_live_/.test(loginHtml) && !/pk_test_/.test(loginHtml);

  const gap002Ok = Boolean(acceptBody?.ok);
  const e2e = {
    clerkProductionPublishable: clerkLive,
    openaiProviderOnline: openai?.status === "ONLINE",
    gap002ReadOnlyOk: gap002Ok,
    stripeMode: acceptBody?.stripeMode ?? modeBody?.stripe?.secretKind ?? null,
    noNewCharge: acceptBody?.newChargeAttempted === false,
    commercialLoopPass: false,
  };
  e2e.commercialLoopPass =
    e2e.clerkProductionPublishable &&
    e2e.openaiProviderOnline &&
    e2e.gap002ReadOnlyOk &&
    e2e.noNewCharge;

  const report = {
    modeStatus: modeRes.status,
    modeOk: Boolean(modeBody?.ok),
    stripeDiag: modeBody?.stripe ?? null,
    gap002: { httpStatus: acceptRes.status, ...acceptBody },
    e2e,
  };

  writeFileSync(join(process.cwd(), ".tmp_gap002_acceptance.json"), redact(JSON.stringify(report, null, 2)));
  console.log(redact(JSON.stringify(report, null, 2)));
  process.exit(e2e.commercialLoopPass ? 0 : 1);
} finally {
  try {
    if (existsSync(outFile)) unlinkSync(outFile);
  } catch {
    /* ignore */
  }
}
