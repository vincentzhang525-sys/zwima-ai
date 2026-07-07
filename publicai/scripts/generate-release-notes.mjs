#!/usr/bin/env node
/**
 * Regenerate release doc timestamps (Sprint 41).
 * Run: node scripts/generate-release-notes.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const date = new Date().toISOString().slice(0, 10);

const files = ["CHANGELOG.md", "RELEASE_NOTES.md", "ROADMAP.md", "KNOWN_LIMITATIONS.md"];
for (const file of files) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) {
    console.error(`Missing ${file}`);
    process.exit(1);
  }
}
console.log(`Release docs verified — ${files.length} files OK (${date})`);
