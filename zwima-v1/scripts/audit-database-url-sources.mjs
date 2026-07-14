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
const teamId = project.orgId;
const projectId = project.projectId;
const headers = { Authorization: `Bearer ${token}` };

const KEYS = ["DATABASE_URL", "DIRECT_URL"];

function iso(ms) {
  return ms ? new Date(ms).toISOString() : null;
}

function summarize(entry, source) {
  const value = entry.value ?? "";
  return {
    source,
    id: entry.id,
    key: entry.key,
    type: entry.type ?? null,
    target: entry.target ?? [],
    gitBranch: entry.gitBranch ?? null,
    projectIds: entry.projectId ?? entry.projectIds ?? null,
    createdAt: entry.createdAt ?? entry.created ?? null,
    createdAtIso: iso(entry.createdAt ?? entry.created),
    updatedAt: entry.updatedAt ?? entry.updated ?? null,
    updatedAtIso: iso(entry.updatedAt ?? entry.updated),
    createdBy: entry.createdBy ?? null,
    updatedBy: entry.updatedBy ?? null,
    valueLength: value.length,
    firstCharacter: value.charAt(0) || null,
    lastCharacter: value.charAt(value.length - 1) || null,
    containsDoubleQuote: value.includes('"'),
    startsWithPostgresql: /^postgres(ql)?:\/\//i.test(value),
    apiDecrypted: value.length > 0,
  };
}

async function getJson(url) {
  const res = await fetch(url, { headers });
  return { status: res.status, body: await res.json() };
}

// Project env (all)
const projectEnv = await getJson(`https://api.vercel.com/v9/projects/${projectId}/env?teamId=${teamId}`);
const projectRows = (projectEnv.body.envs || []).filter((e) => KEYS.includes(e.key));

// Project env decrypt per target
const projectDecrypt = {};
for (const target of ["preview", "production", "development"]) {
  const r = await getJson(
    `https://api.vercel.com/v9/projects/${projectId}/env?teamId=${teamId}&decrypt=true&target=${target}`,
  );
  projectDecrypt[target] = (r.body.envs || [])
    .filter((e) => KEYS.includes(e.key))
    .map((e) => summarize(e, "project"));
}

// Shared env (all, paginated first page)
const sharedEnv = await getJson(`https://api.vercel.com/v1/env?teamId=${teamId}`);
let sharedList = [];
if (Array.isArray(sharedEnv.body)) sharedList = sharedEnv.body;
else if (Array.isArray(sharedEnv.body?.data)) sharedList = sharedEnv.body.data;

const sharedRows = sharedList.filter((e) => KEYS.includes(e.key));

// Other team projects with DATABASE_URL
const teamProjects = await getJson(`https://api.vercel.com/v9/projects?teamId=${teamId}&limit=20`);
const otherProjects = [];
for (const p of teamProjects.body.projects || []) {
  const r = await getJson(`https://api.vercel.com/v9/projects/${p.id}/env?teamId=${teamId}`);
  const hits = (r.body.envs || []).filter((e) => e.key === "DATABASE_URL");
  if (hits.length) {
    otherProjects.push({
      projectId: p.id,
      projectName: p.name,
      entries: hits.map((e) => ({
        id: e.id,
        target: e.target,
        type: e.type,
        updatedAtIso: iso(e.updatedAt),
      })),
    });
  }
}

// Latest preview deployment
const deps = await getJson(
  `https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=1&target=preview`,
);
const latest = deps.body.deployments?.[0];

// Build-time runtime evidence from events
let buildEvidence = null;
if (latest?.uid) {
  const events = await getJson(`https://api.vercel.com/v2/deployments/${latest.uid}/events?teamId=${teamId}`);
  const texts = (events.body || []).map((e) => e?.payload?.text).filter((t) => typeof t === "string");
  const rawMeta = texts.find((t) => t.includes("PREVIEW_RAW_DB_META"));
  const usingDb = texts.find((t) => t.startsWith("Using DB:"));
  buildEvidence = { rawMetaLine: rawMeta || null, usingDbLine: usingDb || null };
}

const previewProjectDb = projectRows.filter(
  (e) => e.key === "DATABASE_URL" && (e.target || []).includes("preview"),
);
const productionProjectDb = projectRows.filter(
  (e) => e.key === "DATABASE_URL" && (e.target || []).includes("production"),
);

console.log(
  JSON.stringify(
    {
      auditedProject: { id: projectId, name: project.projectName },
      latestPreviewDeployment: latest
        ? {
            id: latest.uid,
            url: latest.url,
            createdAtIso: iso(latest.created),
            readyState: latest.readyState,
          }
        : null,
      findings: {
        fromSharedEnv: sharedRows.length > 0,
        fromProjectEnv: projectRows.length > 0,
        duplicateDatabaseUrlInSameProject: projectRows.filter((e) => e.key === "DATABASE_URL").length,
        sharedOverridesProject: false,
        productionDatabaseUrlExists: productionProjectDb.length > 0,
        effectiveSourceForPreview: sharedRows.some((e) => (e.target || []).includes("preview"))
          ? "shared (if no project override)"
          : previewProjectDb.length
            ? "project"
            : "none",
      },
      allDatabaseUrlAndDirectUrl: {
        project: projectRows.map((e) => summarize(e, "project")),
        shared: sharedRows.map((e) => summarize(e, "shared")),
      },
      projectDecryptByTarget: projectDecrypt,
      otherTeamProjectsWithDatabaseUrl: otherProjects,
      currentPreviewDeploymentUses: {
        envKeyPresent: true,
        variableId: previewProjectDb[0]?.id ?? null,
        variableSource: "project",
        variableScope: previewProjectDb[0]?.target ?? [],
        variableType: previewProjectDb[0]?.type ?? null,
        lastUpdatedAtIso: iso(previewProjectDb[0]?.updatedAt),
        deploymentCreatedAtIso: iso(latest?.created),
        deploymentAfterLastEnvUpdate:
          latest && previewProjectDb[0]
            ? latest.created > previewProjectDb[0].updatedAt
            : null,
        buildEvidence,
      },
    },
    null,
    2,
  ),
);
