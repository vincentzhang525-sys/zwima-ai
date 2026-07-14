#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = JSON.parse(fs.readFileSync(path.join(root, ".vercel", "project.json"), "utf8"));
const authPath = path.join(os.homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json");
const token = JSON.parse(fs.readFileSync(authPath, "utf8")).token;
const q = new URLSearchParams({ teamId: project.orgId, limit: "5", target: "preview" });

const deps = await fetch(`https://api.vercel.com/v6/deployments?projectId=${project.projectId}&${q}`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

console.log(
  JSON.stringify(
    (deps.deployments || []).map((d) => ({
      id: d.uid,
      url: `https://${d.url}`,
      state: d.readyState,
      created: d.created,
    })),
    null,
    2,
  ),
);

const prot = await fetch(
  `https://api.vercel.com/v1/projects/${project.projectId}/protection-bypass?${new URLSearchParams({ teamId: project.orgId })}`,
  { headers: { Authorization: `Bearer ${token}` } },
).then((r) => ({ status: r.status, body: await r.json() }));
console.log("protection-bypass", JSON.stringify(prot, null, 2));
