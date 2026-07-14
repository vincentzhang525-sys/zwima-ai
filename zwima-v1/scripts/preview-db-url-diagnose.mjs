import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(file) {
  const map = new Map();
  if (!fs.existsSync(file)) return map;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

function redactUrl(raw) {
  if (!raw) return { present: false, length: 0 };
  const issues = [];
  if (raw.startsWith('"') || raw.startsWith("'")) issues.push("leading quote in raw value");
  if (raw.endsWith('"') || raw.endsWith("'")) issues.push("trailing quote in raw value");
  if (!/^postgres(ql)?:\/\//i.test(raw)) {
    issues.push(`missing postgresql:// or postgres:// prefix (starts with: ${JSON.stringify(raw.slice(0, 20))})`);
  }
  if (/\s/.test(raw)) issues.push("contains whitespace");
  if (raw.includes('?"')) issues.push('contains ?" sequence (quote after query param)');
  if (raw.startsWith('"postgresql') || raw.startsWith("'postgresql")) {
    issues.push("URL wrapped in quotes");
  }

  let masked = raw;
  try {
    const normalized = raw.replace(/^postgres(ql)?:\/\//i, "http://");
    const u = new URL(normalized);
    if (u.password) u.password = "***";
    if (u.username) {
      const [user, tenant] = u.username.includes(".") ? u.username.split(".") : [u.username, null];
      u.username = tenant ? `${user}.${tenant.slice(0, 4)}***` : `${u.username.slice(0, 4)}***`;
    }
    masked = u.toString().replace(/^http:\/\//, raw.match(/^postgres(ql)?:\/\//i)?.[0] ?? "postgresql://");
  } catch (e) {
    issues.push(`URL parse error: ${e instanceof Error ? e.message : String(e)}`);
    masked = raw.replace(/:([^:@/]+)@/, ":***@");
  }

  const refMatch = raw.match(/postgres(?:ql)?:\/\/postgres\.([a-z0-9]+):/i) || raw.match(/@db\.([a-z0-9]+)\.supabase\.co/i);
  return {
    present: true,
    length: raw.length,
    masked,
    projectRef: refMatch?.[1] ?? null,
    firstCharCode: raw.charCodeAt(0),
    lastCharCode: raw.charCodeAt(raw.length - 1),
    valid: issues.length === 0,
    issues,
  };
}

for (const file of [".env.preview.local", ".vercel/.env.preview.local"]) {
  const fp = path.join(root, file);
  const env = parseEnvFile(fp);
  console.log(`\n=== ${file} ===`);
  for (const key of ["DATABASE_URL", "DIRECT_URL", "STRIPE_PREVIEW_DISABLED"]) {
    const raw = env.get(key) ?? "";
    console.log(`${key}:`, JSON.stringify(redactUrl(raw), null, 2));
  }
}
