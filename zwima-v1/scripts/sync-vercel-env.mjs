#!/usr/bin/env node
/**
 * Copy selected env vars from a pulled .env file to zwima-v1 Vercel project.
 * Never logs secret values.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const KEYS = [
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "DEEPSEEK_API_KEY",
  "QWEN_API_KEY",
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
  "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
  "NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL",
  "NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL",
  "NEXT_PUBLIC_APP_URL",
  "ADMIN_EMAILS",
  "CREDITS_MARGIN",
];

const STATIC_DEFAULTS = {
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/login",
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/signup",
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: "/dashboard",
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: "/dashboard",
  ADMIN_EMAILS: "admin@zwima-group.info",
  CREDITS_MARGIN: "1.3",
};

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

function parseEnvFile(file) {
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
    if (val && !key.startsWith("VERCEL_") && key !== "NX_DAEMON" && !key.startsWith("TURBO_")) {
      map.set(key, val);
    }
  }
  return map;
}

async function listExisting(projectId, teamId, token) {
  const q = new URLSearchParams({ teamId });
  const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  const envs = Array.isArray(data.envs) ? data.envs : [];
  return new Set(envs.map((e) => `${e.key}:${(e.target || ["production"]).join(",")}`));
}

async function upsertEnv(projectId, teamId, token, key, value, targets = ["production", "preview"]) {
  const q = new URLSearchParams({ teamId, upsert: "true" });
  const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?${q}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      value,
      type: "encrypted",
      target: targets,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to set ${key}: ${res.status} ${err.slice(0, 200)}`);
  }
}

async function main() {
  const project = JSON.parse(fs.readFileSync(path.join(root, ".vercel", "project.json"), "utf8"));
  const token = loadToken();
  const source = parseEnvFile(path.join(root, ".env.from-zwima-ai"));
  const extra = parseEnvFile(path.join(root, ".env.local"));

  const results = [];
  for (const key of KEYS) {
    const value = source.get(key) || extra.get(key) || STATIC_DEFAULTS[key];
    if (!value) {
      results.push({ key, status: "skipped", reason: "no value" });
      continue;
    }
    try {
      await upsertEnv(project.projectId, project.orgId, token, key, value);
      results.push({ key, status: "set" });
    } catch (err) {
      results.push({ key, status: "error", reason: err instanceof Error ? err.message : "failed" });
    }
  }

  console.log("Env sync to zwima-v1:");
  for (const r of results) {
    console.log(`${r.key}: ${r.status}${r.reason ? " (" + r.reason + ")" : ""}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
