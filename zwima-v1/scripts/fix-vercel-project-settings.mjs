#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const projectId = "prj_gT8eCGD649DAhVlJ0YCCX2wx3D9B";
const teamId = "team_ywGwgNDnLs6bqeh18JOgHg2p";

function loadToken() {
  const authPaths = [
    path.join(os.homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json"),
    path.join(os.homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
  ];
  for (const p of authPaths) {
    if (!fs.existsSync(p)) continue;
    return JSON.parse(fs.readFileSync(p, "utf8")).token;
  }
  throw new Error("no token");
}

const token = loadToken();
const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}?teamId=${teamId}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    rootDirectory: "zwima-v1",
    framework: "nextjs",
    buildCommand: "npm run vercel-build",
    installCommand: "npm install --legacy-peer-deps",
    outputDirectory: null,
  }),
});
const data = await res.json();
console.log(JSON.stringify({ ok: res.ok, buildCommand: data.buildCommand }, null, 2));
