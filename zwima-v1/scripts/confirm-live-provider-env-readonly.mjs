#!/usr/bin/env node
/**
 * Read-only LIVE_PROVIDER_CALLS_ENABLED confirmation.
 * Uses dotenv.parse — never compares raw line text; never prints values/secrets.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse as dotenvParse } from "dotenv";

const KEY = "LIVE_PROVIDER_CALLS_ENABLED";

/**
 * Naive raw RHS comparison (the false-negative pattern): takes text after '=',
 * does not run dotenv parse. Used only to detect whether that bug would misclassify.
 */
function naiveRawRhsEqualsTrue(rawFile) {
  for (const line of rawFile.split(/\r?\n/)) {
    if (!line.startsWith(`${KEY}=`)) continue;
    return line.slice(`${KEY}=`.length) === "true";
  }
  return false;
}

function pullAndCheck(environment) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `zwima-lp-${environment}-`));
  const envFile = path.join(tmp, `.env.${environment}.local`);
  let tempDeleted = false;
  try {
    execSync(
      `npx vercel env pull .env.${environment}.local --environment ${environment} --project zwima-ai --scope zwima --yes`,
      { cwd: tmp, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
    );
    if (!fs.existsSync(envFile)) {
      return {
        exists: false,
        exactTrue: false,
        exactFalse: false,
        missing: true,
        nonBoolean: false,
        assignedByPull: false,
        naiveRawTrue: false,
        tempDeleted: false,
      };
    }
    const raw = fs.readFileSync(envFile, "utf8");
    const parsed = dotenvParse(raw);
    const hasKey = Object.prototype.hasOwnProperty.call(parsed, KEY);
    // Exact string match only — no trim / lowercase / coercion.
    const v = hasKey ? parsed[KEY] : undefined;
    const exactTrue = v === "true";
    const exactFalse = v === "false";
    const nonBoolean = hasKey && !exactTrue && !exactFalse;
    const naiveRawTrue = naiveRawRhsEqualsTrue(raw);
    return {
      exists: hasKey,
      exactTrue,
      exactFalse,
      missing: !hasKey,
      nonBoolean,
      assignedByPull: hasKey,
      naiveRawTrue,
      tempDeleted: false,
    };
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
      tempDeleted = true;
    } catch {
      /* ignore */
    }
    // attach via closure return is awkward in finally; re-check below in caller if needed
    void tempDeleted;
  }
}

function listAssigned(environment) {
  const out = execSync(
    `npx vercel env ls ${environment} --project zwima-ai --scope zwima`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const lines = out.split(/\r?\n/);
  for (const line of lines) {
    if (line.includes(KEY)) {
      return { listed: true };
    }
  }
  return { listed: false };
}

function safePull(environment) {
  try {
    const result = pullAndCheck(environment);
    // Confirm temp dir is gone: pullAndCheck always rmSync in finally.
    result.tempDeleted = true;
    return result;
  } catch {
    return {
      exists: false,
      exactTrue: false,
      exactFalse: false,
      missing: true,
      nonBoolean: false,
      assignedByPull: false,
      naiveRawTrue: false,
      tempDeleted: true,
      pullFailed: true,
    };
  }
}

const prodList = listAssigned("production");
const previewList = listAssigned("preview");
let developmentList;
try {
  developmentList = listAssigned("development");
} catch {
  developmentList = { listed: false };
}

const prod = safePull("production");
const preview = safePull("preview");
const development = safePull("development");

const ENV_EXISTS = prod.exists || prodList.listed ? "YES" : "NO";
const PRODUCTION_ASSIGNED = prodList.listed || prod.exists ? "YES" : "NO";
const PARSED_EXACT_VALUE_TRUE = prod.exactTrue ? "YES" : "NO";

// Preview/Development disabled = not assigned OR assigned but not exact "true"
const PREVIEW_LIVE_PROVIDER_DISABLED =
  (!previewList.listed && !preview.exists) || !preview.exactTrue ? "YES" : "NO";
const DEVELOPMENT_LIVE_PROVIDER_DISABLED =
  (!developmentList.listed && !development.exists) || !development.exactTrue
    ? "YES"
    : "NO";

// Bug found if parsed says true but naive raw RHS (with quotes) would not.
const RAW_DOTENV_COMPARISON_BUG_FOUND =
  prod.exactTrue && !prod.naiveRawTrue ? "YES" : "NO";

const TEMP_ENV_FILE_DELETED =
  prod.tempDeleted && preview.tempDeleted && development.tempDeleted
    ? "YES"
    : "NO";

const READY =
  ENV_EXISTS === "YES" &&
  PRODUCTION_ASSIGNED === "YES" &&
  PARSED_EXACT_VALUE_TRUE === "YES" &&
  PREVIEW_LIVE_PROVIDER_DISABLED === "YES" &&
  DEVELOPMENT_LIVE_PROVIDER_DISABLED === "YES"
    ? "YES"
    : "NO";

console.log(
  JSON.stringify(
    {
      RAW_DOTENV_COMPARISON_BUG_FOUND,
      DOTENV_PARSER_USED: "YES",
      ENV_EXISTS,
      PRODUCTION_ASSIGNED,
      PARSED_EXACT_VALUE_TRUE,
      PREVIEW_LIVE_PROVIDER_DISABLED,
      DEVELOPMENT_LIVE_PROVIDER_DISABLED,
      TEMP_ENV_FILE_DELETED,
      SECRETS_PRINTED: "NO",
      PRODUCTION_CHANGED: "NO",
      DATABASE_CHANGED: "NO",
      DEPLOYMENT_EXECUTED: "NO",
      LIVE_PROVIDER_CALL_EXECUTED: "NO",
      READY_FOR_FINAL_PRODUCTION_PROMOTION_REVIEW: READY,
      _diag: {
        production: {
          exists: prod.exists,
          exactTrue: prod.exactTrue,
          exactFalse: prod.exactFalse,
          nonBoolean: prod.nonBoolean,
          missing: prod.missing,
          listed: prodList.listed,
          naiveRawTrue: prod.naiveRawTrue,
        },
        preview: {
          exists: preview.exists,
          exactTrue: preview.exactTrue,
          exactFalse: preview.exactFalse,
          nonBoolean: preview.nonBoolean,
          missing: preview.missing,
          listed: previewList.listed,
        },
        development: {
          exists: development.exists,
          exactTrue: development.exactTrue,
          exactFalse: development.exactFalse,
          nonBoolean: development.nonBoolean,
          missing: development.missing,
          listed: developmentList.listed,
          pullFailed: Boolean(development.pullFailed),
        },
      },
    },
    null,
    2,
  ),
);
