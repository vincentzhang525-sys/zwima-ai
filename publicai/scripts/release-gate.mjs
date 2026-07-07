#!/usr/bin/env node
/**
 * Sprint 40 — Full production release gate.
 * Usage: node scripts/release-gate.mjs [baseUrl]
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.argv[2] || "https://zwima-group.info").replace(/\/$/, "");
const gates = [];

function gate(name, ok, detail = "") {
  gates.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function run(cmd, label) {
  try {
    const out = execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    return gate(label, true, out.trim().split("\n").pop() || "ok");
  } catch (err) {
    const msg = (err.stderr || err.stdout || err.message || "failed").trim().split("\n").slice(-3).join(" ");
    return gate(label, false, msg);
  }
}

function syntaxCheck() {
  const files = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!["node_modules", ".git"].includes(ent.name)) walk(p);
      } else if (ent.name.endsWith(".js") || ent.name.endsWith(".mjs")) {
        files.push(p);
      }
    }
  }
  walk(root);
  let failed = 0;
  for (const f of files) {
    try {
      execSync(`node --check "${f}"`, { stdio: "pipe" });
    } catch {
      failed += 1;
      console.log(`FAIL  Syntax — ${path.relative(root, f)}`);
    }
  }
  return gate("Syntax check (lint substitute)", failed === 0, `${files.length} files, ${failed} errors`);
}

async function api(pathname, method = "GET", body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${pathname}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function runVerify(script, label) {
  try {
    execSync(`node scripts/${script} "${baseUrl}"`, { cwd: root, encoding: "utf8", stdio: "pipe" });
    return gate(label, true);
  } catch (err) {
    const tail = (err.stdout || err.stderr || "").trim().split("\n").slice(-2).join(" ");
    return gate(label, false, tail || "verification failed");
  }
}

async function main() {
  console.log(`\n========================================`);
  console.log(`RELEASE GATE — ${baseUrl}`);
  console.log(`========================================\n`);

  gate("Formatting", true, "N/A — no Prettier config (vanilla JS project)");
  gate("Type checking", true, "N/A — vanilla JavaScript project (no TypeScript)");
  syntaxCheck();
  run("npm run test:all", "Unit tests (test:all)");
  run("npm run build", "Production build");
  run("node tests/test-supabase-migration-v1.js", "Database migration verification (static)");
  gate("Integration tests", true, "covered by production verify scripts below");

  await runVerify("verify-sprint37-gateway.mjs", "API Gateway verification");
  await runVerify("verify-sprint34-security.mjs", "Authentication & security verification");
  await runVerify("verify-sprint38-commerce.mjs", "Billing verification");
  await runVerify("verify-sprint31-live.mjs", "Credits verification");

  const statusApi = await api("/api/status/public");
  gate(
    "Provider verification",
    statusApi.ok && (statusApi.json?.providers || []).length >= 7,
    statusApi.ok ? `${statusApi.json.providers.length} providers` : statusApi.json?.error || `HTTP ${statusApi.status}`
  );

  await runVerify("verify-sprint36-ops.mjs", "Admin verification");

  await runVerify("verify-sprint35-portal.mjs", "Regression — Sprint 35 portal");
  await runVerify("verify-sprint39-enterprise.mjs", "Regression — Sprint 39 enterprise");
  await runVerify("verify-sprint40-launch.mjs", "Regression — Sprint 40 launch");
  await runVerify("verify-sprint40-final.mjs", "Regression — Sprint 40 final");
  await runVerify("verify-sprint41-ops.mjs", "Sprint 41 ops & legal");

  const login = await api("/api/user/login", "POST", { email: "admin@zwima-group.info", password: "admin123", remember: true });
  gate("Production login", login.ok && !!login.json?.session?.access_token, login.json?.error || `HTTP ${login.status}`);

  const landing = await api("/index.html");
  gate("Production landing", landing.ok && landing.text.includes("Start Free"));

  const gateway = await api("/api/gateway/health");
  gate("Production gateway health", gateway.ok, gateway.json?.error || `HTTP ${gateway.status}`);

  const onboarding = await api("/api/onboarding", "GET", undefined, login.json?.session?.access_token);
  gate("Production onboarding", onboarding.ok && onboarding.json?.onboarding?.totalSteps === 7);

  gate(
    "Mobile responsive check",
    landing.ok && landing.text.includes("viewport") && landing.text.includes("polish.css"),
    "viewport + polish.css"
  );

  gate("Production deployment", landing.ok && gateway.ok, baseUrl);

  const failed = gates.filter((g) => !g.ok).length;
  console.log(`\n========================================`);
  console.log(`${gates.length - failed}/${gates.length} gates passed`);
  console.log(failed ? "RELEASE GATE: FAIL" : "RELEASE GATE: PASS");
  console.log(`========================================\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
