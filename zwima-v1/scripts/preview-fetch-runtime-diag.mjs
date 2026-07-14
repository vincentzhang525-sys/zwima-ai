#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = JSON.parse(fs.readFileSync(path.join(root, ".vercel", "project.json"), "utf8"));
const authPath = path.join(os.homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json");
const token = JSON.parse(fs.readFileSync(authPath, "utf8")).token;
const teamId = project.orgId;
const headers = { Authorization: `Bearer ${token}` };

const deps = await fetch(
  `https://api.vercel.com/v6/deployments?projectId=${project.projectId}&teamId=${teamId}&limit=3&target=preview`,
  { headers },
).then((r) => r.json());

console.log("deployments", JSON.stringify(deps.deployments?.map((d) => ({ url: d.url, state: d.readyState })), null, 2));

const protRes = await fetch(`https://api.vercel.com/v1/projects/${project.projectId}/protection-bypass?teamId=${teamId}`, {
  headers,
});
const protBody = await protRes.json();
console.log("protection", protRes.status, JSON.stringify(protBody, null, 2));

const bypass = protBody?.protectionBypass?.secret || protBody?.bypass?.secret || null;
const latest = deps.deployments?.[0]?.url;
if (bypass && latest) {
  const url = `https://${latest}/api/v1/preview-diag/env-db`;
  const r = await fetch(url, {
    headers: { Accept: "application/json", "x-vercel-protection-bypass": bypass },
    signal: AbortSignal.timeout(60000),
  });
  console.log("runtime", r.status, await r.text());
}
