#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env.vercel.production");
const text = fs.readFileSync(envFile, "utf8");
const oidc = text.match(/VERCEL_OIDC_TOKEN="([^"]+)"/)?.[1];
if (!oidc) throw new Error("No OIDC token");

const res = await fetch(
  "https://api.vercel.com/v9/projects/prj_gT8eCGD649DAhVlJ0YCXc2wx3D9B/env?decrypt=true",
  { headers: { Authorization: `Bearer ${oidc}` } }
);
const data = await res.json();
if (!res.ok) {
  console.error(JSON.stringify(data));
  process.exit(1);
}

const wanted = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "DATABASE_URL",
  "SUPABASE_DB_PASSWORD",
  "POSTGRES_PASSWORD",
  "POSTGRES_URL",
];
for (const key of wanted) {
  const item = data.envs?.find((e) => e.key === key);
  console.log(key, item?.value ? `set(${item.value.length})` : "missing");
}
