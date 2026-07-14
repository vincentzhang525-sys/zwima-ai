#!/usr/bin/env node
/**
 * Fetch Vercel env metadata + redacted DB info via API (never prints secrets).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = JSON.parse(fs.readFileSync(path.join(root, ".vercel", "project.json"), "utf8"));

function loadToken() {
  const authPaths = [
    path.join(os.homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json"),
    path.join(os.homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
  ];
  for (const p of authPaths) {
    if (!fs.existsSync(p)) continue;
    const auth = JSON.parse(fs.readFileSync(p, "utf8"));
    if (auth.token) return auth.token;
  }
  throw new Error("Vercel auth token not found");
}

function redactDb(url) {
  if (!url) return null;
  try {
    const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
    const ref =
      u.hostname.match(/db\.([a-z0-9]+)\.supabase\.co/i)?.[1] ||
      u.username?.replace(/^postgres\./, "") ||
      u.hostname.slice(0, 12) + "…";
    return { host: u.hostname, port: u.port || "5432", database: u.pathname.replace(/^\//, "") || "postgres", projectRef: ref };
  } catch {
    return { invalid: true };
  }
}

const KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_URL",
  "SUPABASE_DB_PASSWORD",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_CREDIT_PRICE_ID",
  "ADMIN_EMAILS",
  "CREDITS_MARGIN",
];

const token = loadToken();
const q = new URLSearchParams({ teamId: project.orgId });
const res = await fetch(`https://api.vercel.com/v9/projects/${project.projectId}/env?${q}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await res.json();
const envs = Array.isArray(data.envs) ? data.envs : [];

const report = { project: project.projectName, vars: {}, dbIsolation: null, issues: [] };

for (const key of KEYS) {
  const matches = envs.filter((e) => e.key === key);
  report.vars[key] = matches.map((e) => ({
    targets: e.target || [],
    type: e.type,
    valueLen: typeof e.value === "string" ? e.value.length : 0,
    hasValue: typeof e.value === "string" && e.value.length > 0,
  }));
}

const dbPreview = envs.find((e) => e.key === "DATABASE_URL" && (e.target || []).includes("preview"));
const directPreview = envs.find((e) => e.key === "DIRECT_URL" && (e.target || []).includes("preview"));
const dbProd = envs.find((e) => e.key === "DATABASE_URL" && (e.target || []).includes("production"));

if (!dbPreview?.value) report.issues.push("Preview DATABASE_URL missing or empty");
if (!directPreview?.value) report.issues.push("Preview DIRECT_URL missing or empty");
if (dbPreview?.value && dbProd?.value && dbPreview.value === dbProd.value) {
  report.issues.push("Preview DATABASE_URL equals Production DATABASE_URL");
}

const dbR = redactDb(dbPreview?.value);
const directR = redactDb(directPreview?.value);
const prodR = redactDb(dbProd?.value);

report.dbIsolation = {
  previewDb: dbR,
  previewDirect: directR,
  productionDb: prodR ? { host: prodR.host, projectRef: prodR.projectRef, database: prodR.database } : null,
  samePreviewRefs: dbR?.projectRef && dbR.projectRef === directR?.projectRef,
  distinctFromProduction:
    !prodR?.projectRef || !dbR?.projectRef ? null : prodR.projectRef !== dbR.projectRef,
};

const stripe = envs.find((e) => e.key === "STRIPE_SECRET_KEY" && (e.target || []).includes("preview"));
if (stripe?.value && !stripe.value.startsWith("sk_test_")) {
  report.issues.push("Preview STRIPE_SECRET_KEY is not sk_test_ (live key risk)");
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.issues.length === 0 && dbPreview?.value ? 0 : 1);
