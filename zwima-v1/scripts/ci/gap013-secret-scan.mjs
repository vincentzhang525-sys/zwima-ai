#!/usr/bin/env node
/**
 * GAP-013 — Secret scan over Git-tracked zwima-v1 files.
 * Never prints secret bodies — only relative paths / pattern ids.
 * Does not call network, migrate, charge, or send email.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(root, "..");

const FORBIDDEN_BASENAMES = new Set([
  ".env",
  ".env.local",
  ".env.e2e.local",
  ".env.development",
  ".env.production",
  ".env.preview",
]);

/** High-confidence secret patterns (values never logged). */
const PATTERNS = [
  { id: "CLERK_SECRET", re: /\bsk_(?:test|live)_[A-Za-z0-9]{20,}\b/ },
  { id: "CLERK_PUBLISHABLE", re: /\bpk_(?:test|live)_[A-Za-z0-9]{20,}\b/ },
  { id: "STRIPE_SECRET", re: /\bsk_(?:test|live)_[A-Za-z0-9]{20,}\b/ },
  { id: "STRIPE_RESTRICTED", re: /\brk_(?:test|live)_[A-Za-z0-9]{16,}\b/ },
  { id: "STRIPE_WEBHOOK", re: /\bwhsec_[A-Za-z0-9]{16,}\b/ },
  { id: "OPENAI_KEY", re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { id: "DATABASE_URL_INLINE", re: /\bDATABASE_URL\s*=\s*["']?(?:postgres|postgresql):\/\/[^\s"']+/i },
  { id: "DIRECT_URL_INLINE", re: /\bDIRECT_URL\s*=\s*["']?(?:postgres|postgresql):\/\/[^\s"']+/i },
  { id: "POSTGRES_URL_INLINE", re: /\bPOSTGRES_URL(?:_NON_POOLING)?\s*=\s*["']?(?:postgres|postgresql):\/\/[^\s"']+/i },
  { id: "PRIVATE_KEY", re: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/ },
  { id: "AWS_ACCESS_KEY", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "GITHUB_PAT", re: /\bghp_[A-Za-z0-9]{36}\b/ },
  { id: "RESEND_KEY", re: /\bre_[A-Za-z0-9]{20,}\b/ },
];

const SKIP_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".pdf",
  ".zip",
  ".gz",
  ".mp4",
  ".lock",
]);

/** Fixture-only paths may contain redaction samples; still ban real .env basenames. */
function isTestOrFixturePath(repoPath) {
  const p = repoPath.replace(/\\/g, "/");
  return (
    /(^|\/)__tests__\//.test(p) ||
    /\.(test|spec)\.(ts|tsx|js|mjs|cjs)$/.test(p) ||
    /(^|\/)fixtures?\//.test(p)
  );
}

function listTrackedZwimaFiles() {
  const out = execSync("git ls-files -z -- zwima-v1", {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out
    .split("\0")
    .filter(Boolean)
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => f.startsWith("zwima-v1/"));
}

function fail(findings) {
  for (const f of findings) {
    console.error(`SECRET_SCAN_HIT id=${f.id} path=${f.path}`);
  }
  console.log("SECRET_SCAN_STATUS=FAIL");
  process.exit(1);
}

const findings = [];
const files = listTrackedZwimaFiles();

for (const repoPath of files) {
  const base = path.posix.basename(repoPath);
  if (FORBIDDEN_BASENAMES.has(base)) {
    findings.push({ id: "FORBIDDEN_ENV_FILE", path: repoPath });
    continue;
  }
  if (base === ".env.example") continue;
  if (isTestOrFixturePath(repoPath)) continue;

  const ext = path.posix.extname(base).toLowerCase();
  if (SKIP_EXT.has(ext)) continue;

  const abs = path.join(repoRoot, repoPath);
  let text;
  try {
    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) continue; // binary
    text = buf.toString("utf8");
  } catch {
    continue;
  }

  // Allow documented placeholders in .env.example only (already skipped).
  // Allow empty assignment lines without values.
  for (const { id, re } of PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) {
      findings.push({ id, path: repoPath });
    }
  }
}

if (findings.length) {
  fail(findings);
}

console.log(`SECRET_SCAN_STATUS=PASS files_scanned=${files.length}`);
process.exit(0);
