#!/usr/bin/env node
/**
 * Fetch decrypted Vercel env vars using CLI auth token or OIDC.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "..");

function loadProjectId() {
  for (const file of [
    path.join(repoRoot, ".vercel", "project.json"),
    path.join(root, ".vercel", "project.json"),
  ]) {
    if (!fs.existsSync(file)) continue;
    const project = JSON.parse(fs.readFileSync(file, "utf8"));
    if (project.projectId) return project.projectId;
  }
  throw new Error("projectId not found. Run: vercel link");
}

const projectId = loadProjectId();
const teamId = (() => {
  for (const file of [
    path.join(repoRoot, ".vercel", "project.json"),
    path.join(root, ".vercel", "project.json"),
  ]) {
    if (!fs.existsSync(file)) continue;
    const project = JSON.parse(fs.readFileSync(file, "utf8"));
    if (project.orgId) return project.orgId;
  }
  return "";
})();

function loadToken() {
  const authPaths = [
    path.join(os.homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json"),
    path.join(os.homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
  ];
  for (const authPath of authPaths) {
    if (!fs.existsSync(authPath)) continue;
    const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
    if (auth.token) return auth.token;
  }

  for (const file of [
    path.join(repoRoot, ".env.local"),
    path.join(root, ".env.local"),
    path.join(repoRoot, ".vercel", ".env.production.local"),
  ]) {
    if (!fs.existsSync(file)) continue;
    const match = fs.readFileSync(file, "utf8").match(/VERCEL_OIDC_TOKEN="([^"]+)"/);
    if (match?.[1]) return match[1];
  }

  throw new Error("No Vercel auth token found. Run: vercel login");
}

const token = loadToken();
const query = new URLSearchParams({ decrypt: "true", target: "production" });
if (teamId) query.set("teamId", teamId);
const res = await fetch(
  `https://api.vercel.com/v9/projects/${projectId}/env?${query}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const data = await res.json();
if (!res.ok) {
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

const envs = Array.isArray(data.envs) ? data.envs : Array.isArray(data) ? data : [];
if (!envs.length) {
  console.error("[fetch-vercel-env] no env vars returned", Object.keys(data));
  process.exit(1);
}

const wanted = process.argv.slice(2);
for (const item of envs) {
  const value = item.value ?? item.decrypted ?? "";
  if (!item.key || !value) continue;
  if (wanted.length && !wanted.includes(item.key)) continue;
  process.env[item.key] = value;
}

if (!wanted.length) {
  for (const item of envs) {
    const value = item.value ?? item.decrypted ?? "";
    if (value) process.env[item.key] = value;
  }
}

for (const key of wanted.length ? wanted : ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  console.log(`${key}=${process.env[key] ? "[set]" : "[missing]"}`);
}

if (!process.env.DATABASE_URL) {
  console.log(
    "[fetch-vercel-env] returned keys:",
    envs.map((item) => `${item.key}${item.value || item.decrypted ? "" : "(empty)"}`).join(", ")
  );
}
