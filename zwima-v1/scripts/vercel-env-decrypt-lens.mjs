#!/usr/bin/env node
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
  throw new Error("no token");
}

function redact(url) {
  if (!url) return null;
  const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
  const ref = u.hostname.match(/db\.([a-z0-9]+)\.supabase\.co/i)?.[1] || u.username?.replace(/^postgres\./, "");
  return { host: u.hostname, database: u.pathname.replace(/^\//, ""), projectRef: ref || "unknown", len: url.length };
}

const token = loadToken();
const q = new URLSearchParams({ teamId: project.orgId });
const list = await fetch(`https://api.vercel.com/v9/projects/${project.projectId}/env?${q}`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  const row = (list.envs || []).find((e) => e.key === key && (e.target || []).includes("preview"));
  if (!row) {
    console.log(key + ": not found for preview");
    continue;
  }
  const one = await fetch(`https://api.vercel.com/v1/projects/${project.projectId}/env/${row.id}?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const val = one.value || "";
  console.log(key + ": decryptedLen=" + val.length + " redacted=" + JSON.stringify(redact(val)));
}
