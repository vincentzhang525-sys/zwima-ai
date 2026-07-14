#!/usr/bin/env node
/** Decrypt Preview DATABASE_URL via Vercel API — outputs masked URL only. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = JSON.parse(fs.readFileSync(path.join(root, ".vercel", "project.json"), "utf8"));

function loadToken() {
  for (const p of [
    path.join(os.homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json"),
    path.join(os.homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
  ]) {
    if (!fs.existsSync(p)) continue;
    const auth = JSON.parse(fs.readFileSync(p, "utf8"));
    if (auth.token) return auth.token;
  }
  throw new Error("Vercel auth token not found");
}

function diagnose(key, raw) {
  const issues = [];
  if (!raw) {
    return { key, present: false, issues: ["empty or not configured for preview"] };
  }
  if (raw.startsWith('"') || raw.endsWith('"') || raw.startsWith("'") || raw.endsWith("'")) {
    issues.push("value contains surrounding quotes");
  }
  if (!/^postgres(ql)?:\/\//i.test(raw)) {
    issues.push(`invalid prefix — starts with: ${JSON.stringify(raw.slice(0, 30))}`);
  }
  if (/\s/.test(raw)) issues.push("contains whitespace");
  if (/[\u201c\u201d\u2018\u2019]/.test(raw)) issues.push("contains Unicode smart quotes");

  let masked = raw;
  try {
    const u = new URL(raw.replace(/^postgres(ql)?:\/\//i, "http://"));
    if (u.password) u.password = "***";
    const parts = u.username.split(".");
    u.username = parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 4)}***` : `${u.username.slice(0, 4)}***`;
    masked = u.toString().replace(/^http:\/\//, "postgresql://");
  } catch (e) {
    issues.push(`URL parse failed: ${e instanceof Error ? e.message : String(e)}`);
    masked = raw.replace(/:([^:@/]+)@/, ":***@");
  }

  const ref =
    raw.match(/postgres(?:ql)?:\/\/postgres\.([a-z0-9]+):/i)?.[1] ||
    raw.match(/@db\.([a-z0-9]+)\.supabase\.co/i)?.[1] ||
    null;

  return {
    key,
    present: true,
    length: raw.length,
    masked,
    projectRef: ref,
    firstChar: raw.charAt(0),
    lastChar: raw.charAt(raw.length - 1),
    valid: issues.length === 0 && /^postgres(ql)?:\/\//i.test(raw),
    issues,
  };
}

const token = loadToken();
const q = new URLSearchParams({ teamId: project.orgId });
const list = await fetch(`https://api.vercel.com/v9/projects/${project.projectId}/env?${q}`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

const report = { project: project.projectName, vars: {} };

for (const key of ["DATABASE_URL", "DIRECT_URL", "STRIPE_PREVIEW_DISABLED"]) {
  const row = (list.envs || []).find((e) => e.key === key && (e.target || []).includes("preview"));
  if (!row) {
    report.vars[key] = diagnose(key, "");
    continue;
  }
  const one = await fetch(`https://api.vercel.com/v1/projects/${project.projectId}/env/${row.id}?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  report.vars[key] = diagnose(key, one.value || "");
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.vars.DATABASE_URL?.valid ? 0 : 1);
