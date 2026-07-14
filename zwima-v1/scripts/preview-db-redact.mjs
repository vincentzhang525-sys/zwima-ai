import { applyResolvedDatabaseUrl, resolveDatabaseUrl } from "../src/lib/database-url.ts";

applyResolvedDatabaseUrl("session");

function redact(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw.replace(/^postgres(ql)?:\/\//, "http://"));
    const ref =
      u.hostname.match(/db\.([a-z0-9]+)\.supabase\.co/i)?.[1] ||
      u.username?.replace(/^postgres\./, "") ||
      u.hostname.slice(0, 12) + "…";
    return {
      host: u.hostname,
      port: u.port || "5432",
      database: u.pathname.replace(/^\//, "") || "postgres",
      projectRef: ref,
    };
  } catch {
    return { invalid: true };
  }
}

let url = process.env.DATABASE_URL || "";
if (!url) {
  try {
    url = resolveDatabaseUrl("session");
  } catch {
    url = "";
  }
}
const direct = process.env.DIRECT_URL || "";

console.log(
  JSON.stringify(
    {
      databaseUrlLen: url.length,
      directUrlLen: direct.length,
      dbRedacted: redact(url),
      directRedacted: redact(direct),
      samePreviewProject: !!(redact(url)?.projectRef && redact(url)?.projectRef === redact(direct)?.projectRef),
      supabaseUrlHost: (process.env.SUPABASE_URL || "").replace(/^https:\/\//, "").split("/")[0] || null,
    },
    null,
    2
  )
);
