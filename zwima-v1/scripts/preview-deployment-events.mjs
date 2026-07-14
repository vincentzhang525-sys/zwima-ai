#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const depId = process.argv[2] || "dpl_EgfLVrAuNdck78Ny5PLTYHPhFRVw";
const project = JSON.parse(fs.readFileSync(path.join(root, ".vercel", "project.json"), "utf8"));
const auth = JSON.parse(
  fs.readFileSync(
    path.join(process.env.USERPROFILE || process.env.HOME, "AppData/Roaming/xdg.data/com.vercel.cli/auth.json"),
    "utf8",
  ),
);
const token = auth.token;
const events = await fetch(`https://api.vercel.com/v2/deployments/${depId}/events?teamId=${project.orgId}`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

const texts = (events || []).map((e) => e?.payload?.text).filter((t) => typeof t === "string");
const keywords = [
  "Using DB:",
  "Schema",
  "migrate",
  "seed",
  "Prisma",
  "error",
  "FAIL",
  "PASS",
  "Stripe Step 2",
  "Applying schema",
  "Bootstrap",
];
const hits = texts.filter((t) => keywords.some((k) => t.toLowerCase().includes(k.toLowerCase())));
console.log(JSON.stringify({ deploymentId: depId, hits }, null, 2));
