#!/usr/bin/env node
/**
 * Probe Preview DB via Vercel-injected env — outputs redacted info only.
 */
import { execSync } from "node:child_process";
import pg from "pg";

function redact(url) {
  if (!url) return null;
  try {
    const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
    const refMatch = u.hostname.match(/db\.([a-z0-9]+)\.supabase\.co/i);
    const poolerMatch = u.hostname.match(/\.pooler\.supabase\.com/i);
    return {
      host: u.hostname,
      port: u.port || "5432",
      database: u.pathname.replace(/^\//, "") || "postgres",
      projectRef: refMatch?.[1] ?? (poolerMatch ? u.username?.replace(/^postgres\./, "") : u.hostname.slice(0, 16) + "…"),
      hasPassword: !!u.password,
    };
  } catch {
    return { invalid: true };
  }
}

const probeScript = `
import { applyResolvedDatabaseUrl } from "./src/lib/database-url.ts";
applyResolvedDatabaseUrl("session");
const url = process.env.DATABASE_URL || "";
const direct = process.env.DIRECT_URL || "";
console.log(JSON.stringify({
  databaseUrlLen: url.length,
  directUrlLen: direct.length,
  database: ${JSON.stringify("PLACEHOLDER")}.databaseUrlLen ? "set" : "empty",
  dbRedacted: (() => { try { const u = url; ${""} return null; } catch { return null; } })()
}));
`;

// Run inside vercel env run to inject preview secrets without writing them to disk
const inline = `
const { applyResolvedDatabaseUrl, resolveDatabaseUrl } = await import("./src/lib/database-url.ts");
applyResolvedDatabaseUrl("session");
const url = process.env.DATABASE_URL || resolveDatabaseUrl("session");
const direct = process.env.DIRECT_URL || "";
function redact(raw){
  if(!raw) return null;
  const u = new URL(raw.replace(/^postgres(ql)?:\\/\\//,'http://'));
  const ref = u.hostname.match(/db\\.([a-z0-9]+)\\.supabase\\.co/i)?.[1]
    || u.username?.replace(/^postgres\\./,'')
    || u.hostname.slice(0,12)+'…';
  return { host: u.hostname, port: u.port||'5432', database: u.pathname.replace(/^\\//,'')||'postgres', projectRef: ref };
}
console.log(JSON.stringify({
  databaseUrlLen: url.length,
  directUrlLen: direct.length,
  dbRedacted: redact(url),
  directRedacted: redact(direct),
  sameRef: redact(url)?.projectRef && redact(url)?.projectRef === redact(direct)?.projectRef,
  supabaseUrlHost: (process.env.SUPABASE_URL||'').replace(/https:\\/\\//,'').split('/')[0] || null,
}, null, 2));
`;

try {
  const out = execSync(`npx vercel env run --environment=preview -- node --input-type=module -e "${inline.replace(/"/g, '\\"').replace(/\n/g, " ")}"`, {
    cwd: new URL("../", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
  });
  console.log(out);
} catch (err) {
  const stdout = err.stdout?.toString?.() ?? "";
  const stderr = err.stderr?.toString?.() ?? "";
  console.log(stdout || stderr || (err instanceof Error ? err.message : String(err)));
  process.exit(1);
}
