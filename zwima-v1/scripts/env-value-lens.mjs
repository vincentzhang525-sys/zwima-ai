import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, ".env.preview.zwima-ai.local");
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

for (const k of [
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_URL",
  "SUPABASE_DB_PASSWORD",
  "STRIPE_SECRET_KEY",
  "OPENAI_API_KEY",
]) {
  console.log(`${k}: length=${map.get(k) ?? 0}`);
}
