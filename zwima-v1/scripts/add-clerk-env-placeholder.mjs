#!/usr/bin/env node
/** Add required Clerk env placeholders to zwima-ai for middleware boot (replace with real keys in Dashboard). */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const projectId = "prj_gT8eCGD649DAhVlJ0YCCX2wx3D9B";
const teamId = "team_ywGwgNDnLs6bqeh18JOgHg2p";

const VARS = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_zwima-v1-deploy-placeholder",
  CLERK_SECRET_KEY: "sk_test_zwima-v1-deploy-placeholder",
  NEXT_PUBLIC_APP_URL: "https://zwima-group.info",
};

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
for (const [key, value] of Object.entries(VARS)) {
  const q = new URLSearchParams({ teamId, upsert: "true" });
  const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?${q}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key, value, type: key.includes("PUBLIC") ? "plain" : "encrypted", target: ["production", "preview"] }),
  });
  console.log(key, res.ok ? "set" : `fail ${res.status}`);
}
