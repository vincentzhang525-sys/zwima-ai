#!/usr/bin/env node
/** Set Preview-only env for Phase 4 validation — never touches Production targets. */
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
  throw new Error("no vercel token");
}

function parseEnvFile(file) {
  const map = new Map();
  if (!fs.existsSync(file)) return map;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map.set(t.slice(0, i).trim(), val);
  }
  return map;
}

async function upsertPreview(key, value, type = "encrypted") {
  const token = loadToken();
  const q = new URLSearchParams({ teamId: project.orgId, upsert: "true" });
  const res = await fetch(`https://api.vercel.com/v10/projects/${project.projectId}/env?${q}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key, value, type, target: ["preview"] }),
  });
  if (!res.ok) throw new Error(`${key} failed ${res.status}`);
  console.log(`${key}: preview set (len=${value.length})`);
}

async function main() {
  const local = parseEnvFile(path.join(root, ".env.local"));
  const fromAi = parseEnvFile(path.join(root, ".env.from-zwima-ai"));

  await upsertPreview("ROUTING_ENGINE", "smart", "plain");
  await upsertPreview("STRIPE_PREVIEW_DISABLED", "true", "plain");

  for (const key of ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]) {
    const value = local.get(key) || fromAi.get(key);
    if (!value || value.includes("placeholder")) {
      console.log(`${key}: skipped (no real value in local env files)`);
      continue;
    }
    const type = key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted";
    await upsertPreview(key, value, type);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
