#!/usr/bin/env node
/**
 * Preview env safety check — never prints secret values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFileArg = (process.env.PREVIEW_ENV_FILE || "").trim();
const envFile = envFileArg
  ? path.resolve(root, envFileArg)
  : fs.existsSync(path.join(root, ".env.preview.zwima-ai.local"))
    ? path.join(root, ".env.preview.zwima-ai.local")
    : path.join(root, ".env.preview.local");

function parseEnv(file) {
  const map = new Map();
  if (!fs.existsSync(file)) return map;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

function redactDbUrl(url) {
  if (!url) return { ok: false, reason: "missing" };
  try {
    const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
    const host = u.hostname;
    const port = u.port || "5432";
    const db = u.pathname.replace(/^\//, "") || "(default)";
    const user = u.username ? `${u.username.slice(0, 2)}***` : "(none)";
    const refMatch = host.match(/db\.([a-z0-9]+)\.supabase\.co/i);
    const projectRef = refMatch ? refMatch[1] : host.includes("supabase") ? host.split(".")[1] ?? host : host.slice(0, 12) + "…";
    return { ok: true, host, port, database: db, userRedacted: user, projectRef };
  } catch {
    return { ok: false, reason: "invalid_url_format" };
  }
}

const REQUIRED = [
  "DATABASE_URL",
  "DIRECT_URL",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_CREDIT_PRICE_ID",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "DEEPSEEK_API_KEY",
  "QWEN_API_KEY",
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_APP_URL",
  "ADMIN_EMAILS",
  "CREDITS_MARGIN",
];

const OPTIONAL = ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "CLERK_WEBHOOK_SECRET"];

const env = parseEnv(envFile);
const missing = [];
const issues = [];
const present = {};

for (const key of REQUIRED) {
  const val = env.get(key);
  if (!val || val.trim() === "") {
    missing.push(key);
    present[key] = false;
  } else {
    present[key] = true;
  }
}

for (const key of OPTIONAL) {
  const val = env.get(key);
  present[key] = !!(val && val.trim());
}

const stripeSecret = env.get("STRIPE_SECRET_KEY") ?? "";
const stripePreviewDisabled = env.get("STRIPE_PREVIEW_DISABLED") === "true";
if (stripeSecret && !stripePreviewDisabled && !stripeSecret.startsWith("sk_test_")) {
  issues.push("STRIPE_SECRET_KEY must use sk_test_ prefix (Preview test mode only)");
}
const stripePk = env.get("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") ?? "";
if (stripePk && !stripePreviewDisabled && !stripePk.startsWith("pk_test_")) {
  issues.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must use pk_test_ prefix");
}

const db = redactDbUrl(env.get("DATABASE_URL"));
const direct = redactDbUrl(env.get("DIRECT_URL"));

if (!db.ok) issues.push(`DATABASE_URL: ${db.reason}`);
if (!direct.ok) issues.push(`DIRECT_URL: ${direct.reason}`);

if (db.ok && direct.ok) {
  if (db.projectRef !== direct.projectRef) {
    issues.push("DATABASE_URL and DIRECT_URL project reference mismatch");
  }
  const previewHint = /preview|zwima-ai-preview/i.test(db.host + db.database + db.projectRef);
  if (!previewHint && !db.host.includes("supabase")) {
    issues.push("Cannot confirm Supabase Preview project (expected zwima-ai-preview ref in host)");
  }
}

const clerkPk = env.get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") ?? "";
if (clerkPk && !clerkPk.startsWith("pk_")) {
  issues.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY format unexpected");
}

const report = {
  envFile: path.relative(root, envFile).replace(/\\/g, "/"),
  vercelEnv: env.get("VERCEL_ENV") ?? "(not in file)",
  requiredPresent: present,
  missing,
  issues,
  dbRedacted: db.ok ? { host: db.host, port: db.port, database: db.database, projectRef: db.projectRef, user: db.userRedacted } : null,
  directRedacted: direct.ok ? { host: direct.host, port: direct.port, database: direct.database, projectRef: direct.projectRef, user: direct.userRedacted } : null,
  samePreviewProject: db.ok && direct.ok && db.projectRef === direct.projectRef,
  safeToMigrate: missing.length === 0 && issues.length === 0 && db.ok && direct.ok,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.safeToMigrate ? 0 : 1);
