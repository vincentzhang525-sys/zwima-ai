#!/usr/bin/env node
/** RC1 release gate — Sprint 50.2 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.argv[2] || "https://zwima-group.info";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: true });
  return r.status === 0;
}

const steps = [
  ["npm", ["run", "test:all"]],
  ["node", ["scripts/release-gate.mjs", base]],
  ["node", ["scripts/verify-sprint502-commercial.mjs", base]],
  ["node", ["scripts/security-audit.mjs", base]],
  ["node", ["scripts/stress-gateway.mjs", base]],
];

let ok = true;
for (const [cmd, args] of steps) {
  if (!run(cmd, args)) ok = false;
}
process.exit(ok ? 0 : 1);
