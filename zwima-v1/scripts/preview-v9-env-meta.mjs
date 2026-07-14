#!/usr/bin/env node
/** Vercel v9 decrypt preview env — metadata only for DATABASE_URL */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = JSON.parse(fs.readFileSync(path.join(root, ".vercel", "project.json"), "utf8"));

function loadToken() {
  const authPath = path.join(os.homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json");
  const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
  if (!auth.token) throw new Error("no token");
  return auth.token;
}

function analyze(raw) {
  const value = raw ?? "";
  const first = value.charAt(0);
  const last = value.charAt(value.length - 1);
  let urlParseOk = false;
  let urlParseError = null;
  if (value) {
    try {
      const normalized = value.replace(/^postgres(ql)?:\/\//i, "http://");
      new URL(normalized);
      urlParseOk = /^postgres(ql)?:\/\//i.test(value);
      if (!urlParseOk) urlParseError = "missing postgresql:// or postgres:// prefix";
    } catch (err) {
      urlParseError = err instanceof Error ? err.message : "URL parse failed";
    }
  } else {
    urlParseError = "DATABASE_URL empty";
  }
  return {
    length: value.length,
    firstCharacter: first || null,
    firstCharacterCode: first ? first.charCodeAt(0) : null,
    lastCharacter: last || null,
    lastCharacterCode: last ? last.charCodeAt(0) : null,
    containsDoubleQuote: value.includes('"'),
    containsNewline: /[\r\n]/.test(value),
    containsSpace: /\s/.test(value),
    urlParseOk,
    urlParseError,
    prismaConnectionStringOk: Boolean(value && urlParseOk),
    prismaError: !value ? "DATABASE_URL empty" : urlParseOk ? null : urlParseError,
  };
}

const token = loadToken();
const q = new URLSearchParams({ decrypt: "true", target: "preview", teamId: project.orgId });
const res = await fetch(`https://api.vercel.com/v9/projects/${project.projectId}/env?${q}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await res.json();
if (!res.ok) {
  console.error(JSON.stringify(data, null, 2));
  process.exit(2);
}

const envs = data.envs || [];
const keys = envs.map((e) => `${e.key}:${(e.value || "").length}`);
const db = envs.find((e) => e.key === "DATABASE_URL");
const bypass = envs.find((e) => e.key === "VERCEL_AUTOMATION_BYPASS_SECRET");

console.log(JSON.stringify({ envKeyLengths: keys, databaseUrl: analyze(db?.value || "") }, null, 2));

if (bypass?.value) {
  const url = "https://zwima-5gm0re5gi-zwima.vercel.app/api/v1/preview-diag/env-db";
  const r = await fetch(url, {
    headers: {
      Accept: "application/json",
      "x-vercel-protection-bypass": bypass.value,
    },
    signal: AbortSignal.timeout(60000),
  });
  const text = await r.text();
  console.log("runtime_status", r.status);
  if (r.status === 200) console.log(text);
}

process.exit(db?.value && analyze(db.value).prismaConnectionStringOk ? 0 : 1);
