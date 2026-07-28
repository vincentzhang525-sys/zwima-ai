#!/usr/bin/env node
/**
 * GAP-001 — authorized Production smoke loader.
 * Pulls Production env to a temp file, runs smoke, deletes temp. Never prints secrets.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outFile = join(tmpdir(), `zwima-gap001-smoke-${Date.now()}.env`);

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

try {
  const pull = spawnSync(
    "npx",
    ["vercel", "env", "pull", outFile, "--environment", "production", "--yes"],
    { encoding: "utf8", shell: true },
  );
  if (pull.status !== 0) {
    console.log(JSON.stringify({ ok: false, stage: "env_pull", error: "vercel env pull failed" }));
    process.exit(1);
  }
  const map = parseEnv(readFileSync(outFile, "utf8"));
  const apiKey = map.SMOKE_TEST_API_KEY || "";
  const live = map.LIVE_PROVIDER_CALLS_ENABLED === "true";
  const openaiPresent = Boolean(map.OPENAI_API_KEY && !/placeholder/i.test(map.OPENAI_API_KEY));

  console.log(
    JSON.stringify({
      liveProviderFlagExactTrue: live,
      openaiKeyPresent: openaiPresent,
      smokeKeyPresent: Boolean(apiKey),
      smokeKeyPrefixClass: apiKey.startsWith("sk_live_")
        ? "sk_live"
        : apiKey.startsWith("sk_test_")
          ? "sk_test"
          : apiKey
            ? "other"
            : "missing",
    }),
  );

  if (!live || !openaiPresent || !apiKey) {
    console.log(JSON.stringify({ ok: false, blocked: true, reason: "missing_live_or_keys" }));
    process.exit(2);
  }

  const smoke = spawnSync("node", ["scripts/gap001-closed-beta-smoke.mjs"], {
    encoding: "utf8",
    shell: true,
    env: {
      ...process.env,
      CLOSED_BETA_SMOKE_AUTHORIZED: "true",
      SMOKE_BASE_URL: process.env.SMOKE_BASE_URL || "https://zwima-group.info",
      SMOKE_TEST_API_KEY: apiKey,
      SMOKE_MODEL: process.env.SMOKE_MODEL || "gpt-5-mini",
    },
  });
  process.stdout.write(smoke.stdout || "");
  process.stderr.write(smoke.stderr || "");
  process.exit(smoke.status ?? 1);
} finally {
  try {
    if (existsSync(outFile)) unlinkSync(outFile);
  } catch {
    /* ignore */
  }
}
