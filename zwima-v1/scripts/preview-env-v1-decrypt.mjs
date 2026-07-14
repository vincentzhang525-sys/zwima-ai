#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = JSON.parse(fs.readFileSync(path.join(root, ".vercel", "project.json"), "utf8"));
const token = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), "AppData/Roaming/xdg.data/com.vercel.cli/auth.json"), "utf8"),
).token;
const q = new URLSearchParams({ teamId: project.orgId });

const list = await fetch(`https://api.vercel.com/v9/projects/${project.projectId}/env?${q}`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

const row = (list.envs || []).find((e) => e.key === "DATABASE_URL" && (e.target || []).includes("preview"));
console.log("row", JSON.stringify({ id: row?.id, type: row?.type, target: row?.target, decrypted: row?.decrypted }, null, 2));

if (row?.id) {
  const res = await fetch(`https://api.vercel.com/v1/projects/${project.projectId}/env/${row.id}?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const one = { status: res.status, body: await res.json() };
  const raw = one.body?.value || "";
  console.log("v1", one.status, "valueLength", raw.length);
  if (raw) {
    console.log(
      JSON.stringify(
        {
          firstCharacter: raw.charAt(0),
          lastCharacter: raw.charAt(raw.length - 1),
          containsDoubleQuote: raw.includes('"'),
          containsNewline: /[\r\n]/.test(raw),
          containsSpace: /\s/.test(raw),
        },
        null,
        2,
      ),
    );
  }
}
