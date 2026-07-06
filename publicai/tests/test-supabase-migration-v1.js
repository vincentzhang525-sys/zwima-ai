#!/usr/bin/env node
/**
 * Sprint 27 — Supabase Database Migration V1 automated tests.
 * Static/schema checks always run; live API tests run when SUPABASE_URL is set.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed += 1;
    console.error(`  FAIL: ${message}`);
    return;
  }
  passed += 1;
  console.log(`  OK: ${message}`);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

console.log("\n=== Sprint 27 — Supabase Migration V1 ===\n");

console.log("1. Schema & file structure");
const schema = read("supabase/schema.sql");
const tables = [
  "profiles",
  "credit_wallets",
  "credit_transactions",
  "usage_records",
  "api_keys",
  "playground_conversations",
];
for (const table of tables) {
  assert(schema.includes(`public.${table}`), `schema defines table ${table}`);
}
assert(schema.includes("enable row level security"), "RLS enabled on tables");
assert(schema.includes("is_admin()"), "admin helper function defined");
assert(schema.includes("handle_new_user"), "signup trigger defined");

const apiRoutes = [
  "api/lib/supabase.js",
  "api/user/login.js",
  "api/user/register.js",
  "api/user/me.js",
  "api/user/profile.js",
  "api/db/seed-users.js",
  "api/credits/index.js",
  "api/usage/index.js",
  "api/apikeys/index.js",
  "api/conversations/index.js",
  "api/public-config.js",
];
for (const route of apiRoutes) {
  assert(fileExists(route), `${route} exists`);
}

const clientServices = [
  "services/db/dbMode.js",
  "services/db/supabaseApi.js",
  "services/auth/supabaseAuthAdapter.js",
  "services/db/supabaseCredits.js",
  "services/db/supabaseUsage.js",
  "services/db/supabaseApiKeys.js",
  "services/conversationService.js",
  "services/bootstrap-data.js",
  "scripts/generate-runtime-config.mjs",
];
for (const svc of clientServices) {
  assert(fileExists(svc), `${svc} exists`);
}

console.log("\n2. HTML pages load Supabase client stack");
const htmlPages = [
  "login.html",
  "signup.html",
  "dashboard.html",
  "playground.html",
  "usage.html",
  "credits.html",
  "apikeys.html",
  "settings.html",
];
for (const page of htmlPages) {
  const html = read(page);
  assert(html.includes("config.runtime.js"), `${page} includes config.runtime.js`);
  assert(html.includes("supabaseAuthAdapter.js"), `${page} includes supabaseAuthAdapter.js`);
}

console.log("\n3. Runtime config generator");
execSync("node scripts/generate-runtime-config.mjs", { cwd: ROOT, stdio: "pipe" });
assert(fileExists("config.runtime.js"), "config.runtime.js generated");
const runtimeJs = read("config.runtime.js");
assert(runtimeJs.includes("__ZWIMA_RUNTIME__"), "runtime global exported");

console.log("\n4. dbMode detection (vm)");
function runDbModeTest(env) {
  const context = {
    window: {},
    ZWIMA_CONFIG: { AUTH_PROVIDER: env.AUTH_PROVIDER || "localStorage" },
    console,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("services/db/dbMode.js"), context);
  return context.window.ZwimaDbMode.isSupabaseMode();
}

assert(runDbModeTest({ AUTH_PROVIDER: "localStorage" }) === false, "localStorage mode off");
contextRuntime = { AUTH_PROVIDER: "supabase", SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon" };
const ctx2 = {
  window: {},
  ZWIMA_CONFIG: contextRuntime,
  __ZWIMA_RUNTIME__: contextRuntime,
  console,
};
ctx2.window = ctx2;
vm.createContext(ctx2);
vm.runInContext(read("config.js"), ctx2);
vm.runInContext(read("services/db/dbMode.js"), ctx2);
assert(ctx2.window.ZwimaDbMode.isSupabaseMode() === true, "supabase mode on when configured");

console.log("\n5. API modules load without syntax errors");
for (const route of apiRoutes) {
  try {
    require(path.join(ROOT, route));
    assert(true, `${route} loads`);
  } catch (err) {
    assert(false, `${route} loads — ${err.message}`);
  }
}

console.log("\n6. localStorage fallback still works (user-system regression)");
try {
  execSync("node tests/test-user-system-v1.js", { cwd: ROOT, stdio: "pipe" });
  assert(true, "test-user-system-v1.js passes");
} catch (err) {
  const out = err.stdout?.toString() || err.stderr?.toString() || err.message;
  assert(false, `test-user-system-v1.js — ${out.slice(-400)}`);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnon = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseAnon && serviceKey) {
  console.log("\n7. Live Supabase integration (env detected)");
  (async () => {
    try {
      const { createClient } = require("@supabase/supabase-js");
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: profiles, error } = await admin.from("profiles").select("email").limit(1);
      assert(!error, `profiles query — ${error?.message || "ok"}`);
      assert(Array.isArray(profiles), "profiles returns array");
    } catch (err) {
      assert(false, `live integration — ${err.message}`);
    }
    finish();
  })();
} else {
  console.log("\n7. Live Supabase integration — SKIPPED (set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)");
  finish();
}

function finish() {
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}
