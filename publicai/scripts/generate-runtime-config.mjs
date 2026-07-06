import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const enabled = Boolean(supabaseUrl && supabaseAnonKey);

const runtime = {
  AUTH_PROVIDER: enabled ? "supabase" : process.env.AUTH_PROVIDER || "localStorage",
  DB_DRIVER: enabled ? "supabase" : process.env.DB_DRIVER || "mock",
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabaseAnonKey,
};

const contents = `// Generated at build time — do not edit manually
window.__ZWIMA_RUNTIME__ = ${JSON.stringify(runtime, null, 2)};
`;

fs.writeFileSync(path.join(root, "config.runtime.js"), contents, "utf8");
console.log(`Runtime config written (authProvider=${runtime.AUTH_PROVIDER})`);
