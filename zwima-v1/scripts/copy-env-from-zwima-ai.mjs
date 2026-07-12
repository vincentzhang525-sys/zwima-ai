#!/usr/bin/env node
/**
 * Copy env vars from zwima-ai → zwima-v1 via Vercel API (no secret logging).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SOURCE_PROJECT = "prj_gT8eCGD649DAhVlJ0YCCX2wx3D9B";
const COPY_KEYS = [
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "DEEPSEEK_API_KEY",
  "QWEN_API_KEY",
  "ANTHROPIC_API_KEY",
];

const STATIC = {
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

async function fetchEnv(projectId, teamId, token, decrypt) {
  const q = new URLSearchParams({ teamId });
  if (decrypt) q.set("decrypt", "true");
  const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`fetch env failed: ${res.status}`);
  return Array.isArray(data.envs) ? data.envs : Array.isArray(data) ? data : [];
}

async function upsertEnv(projectId, teamId, token, key, value, targets = ["production", "preview"]) {
  const q = new URLSearchParams({ teamId, upsert: "true" });
  const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?${q}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key, value, type: "encrypted", target: targets }),
  });
  if (!res.ok) throw new Error(`set ${key} failed: ${res.status}`);
}

async function main() {
  const target = JSON.parse(fs.readFileSync(path.join(root, ".vercel", "project.json"), "utf8"));
  const token = loadToken();
  const teamId = target.orgId;

  const sourceEnvs = await fetchEnv(SOURCE_PROJECT, teamId, token, true);
  const map = new Map();
  for (const item of sourceEnvs) {
    const val = item.value ?? item.decrypted ?? "";
    if (item.key && val) map.set(item.key, val);
  }

  console.log("Source env keys with values:", [...map.keys()].filter((k) => COPY_KEYS.includes(k)).join(", ") || "(none)");

  const targetId = target.projectId;
  for (const key of COPY_KEYS) {
    const val = map.get(key);
    if (!val) {
      console.log(`${key}: 缺失 (source)`);
      continue;
    }
    await upsertEnv(targetId, teamId, token, key, val);
    console.log(`${key}: 存在 → copied`);
  }

  for (const [key, val] of Object.entries(STATIC)) {
    await upsertEnv(targetId, teamId, token, key, val);
    console.log(`${key}: set`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
