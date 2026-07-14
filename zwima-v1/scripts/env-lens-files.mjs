import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function lens(file) {
  if (!fs.existsSync(file)) return { file, exists: false };
  const map = new Map();
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i);
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map.set(key, val.length);
  }
  return {
    file: path.relative(root, file),
    exists: true,
    DATABASE_URL: map.get("DATABASE_URL") ?? 0,
    DIRECT_URL: map.get("DIRECT_URL") ?? 0,
    SUPABASE_URL: map.get("SUPABASE_URL") ?? 0,
    SUPABASE_DB_PASSWORD: map.get("SUPABASE_DB_PASSWORD") ?? 0,
  };
}

for (const f of [".env.preview.local", ".vercel/.env.preview.local"]) {
  console.log(JSON.stringify(lens(path.join(root, f))));
}
