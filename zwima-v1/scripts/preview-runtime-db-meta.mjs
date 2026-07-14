#!/usr/bin/env node
/** Preview DATABASE_URL metadata via OIDC decrypt + optional runtime diag fetch */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = JSON.parse(fs.readFileSync(path.join(root, ".vercel", "project.json"), "utf8"));

function loadOidc() {
  const text = fs.readFileSync(path.join(root, ".env.preview.local"), "utf8");
  const m = text.match(/VERCEL_OIDC_TOKEN="([^"]+)"/);
  if (!m?.[1]) throw new Error("VERCEL_OIDC_TOKEN missing in .env.preview.local");
  return m[1];
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

const oidc = loadOidc();
const q = new URLSearchParams({ decrypt: "true", target: "preview", teamId: project.orgId });
const envRes = await fetch(`https://api.vercel.com/v9/projects/${project.projectId}/env?${q}`, {
  headers: { Authorization: `Bearer ${oidc}` },
});
const envData = await envRes.json();

const dbRow = (envData.envs || []).find((e) => e.key === "DATABASE_URL");
const bypassRow = (envData.envs || []).find((e) => e.key === "VERCEL_AUTOMATION_BYPASS_SECRET");
const storedMeta = analyze(dbRow?.value || "");

const depRes = await fetch(
  `https://api.vercel.com/v6/deployments?projectId=${project.projectId}&teamId=${project.orgId}&limit=1&target=preview`,
  { headers: { Authorization: `Bearer ${oidc}` } },
);
const depData = await depRes.json();
const latestUrl = depData.deployments?.[0]?.url
  ? `https://${depData.deployments[0].url}/api/v1/preview-diag/env-db`
  : "https://zwima-5gm0re5gi-zwima.vercel.app/api/v1/preview-diag/env-db";

const headers = { Accept: "application/json" };
if (bypassRow?.value) headers["x-vercel-protection-bypass"] = bypassRow.value;

const runtimeRes = await fetch(latestUrl, { headers, redirect: "manual", signal: AbortSignal.timeout(60000) });
const runtimeText = await runtimeRes.text();

const out = {
  vercelEnvApi: { status: envRes.status, databaseUrl: storedMeta },
  latestPreviewDeployment: depData.deployments?.[0]?.url || null,
  runtimeDiag: { url: latestUrl, status: runtimeRes.status },
};

if (runtimeRes.status === 200) {
  const parsed = JSON.parse(runtimeText);
  out.runtimeDiag.databaseUrl = parsed.databaseUrl;
  out.source = "preview_deployment_runtime";
  console.log(JSON.stringify(out.runtimeDiag.databaseUrl, null, 2));
} else {
  out.source = "vercel_preview_env_api_fallback";
  out.runtimeDiag.bodyPreview = runtimeText.slice(0, 200);
  console.log(JSON.stringify(out, null, 2));
}

process.exit(
  (runtimeRes.status === 200 ? JSON.parse(runtimeText).databaseUrl?.prismaConnectionStringOk : storedMeta.prismaConnectionStringOk)
    ? 0
    : 1,
);
