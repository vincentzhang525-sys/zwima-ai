import fs from "node:fs";
for (const f of process.argv.slice(2)) {
  if (!fs.existsSync(f)) {
    console.log(`${f}: MISSING`);
    continue;
  }
  const keys = [];
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=/.exec(line.trim());
    if (m) keys.push(m[1]);
  }
  console.log(`${f}: ${keys.length} keys`);
  console.log(keys.sort().join(", "));
}
