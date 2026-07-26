#!/usr/bin/env node
/**
 * Corrected required-capability presence using filesystem + known Preview runtime.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");

function exists(...parts) {
  return fs.existsSync(path.join(src, ...parts));
}

const checks = [
  ["home", exists("app", "page.tsx")],
  ["login", exists("app", "login", "page.tsx")],
  ["signup", exists("app", "signup", "page.tsx")],
  ["forgot-password", exists("app", "forgot-password", "page.tsx")],
  ["dashboard", exists("app", "dashboard", "page.tsx") || exists("app", "dashboard", "layout.tsx")],
  ["billing", exists("app", "dashboard", "billing", "page.tsx") && exists("app", "api", "v1", "billing", "route.ts")],
  ["admin-models", exists("app", "dashboard", "admin", "models", "page.tsx") && exists("app", "api", "admin", "models", "route.ts")],
  ["admin-providers", exists("app", "dashboard", "admin", "providers", "page.tsx") && exists("app", "api", "admin", "providers", "route.ts")],
  ["agents-api", exists("app", "api", "v1", "agents", "route.ts")],
  ["agents-ui", exists("app", "dashboard", "agents", "page.tsx")],
  ["api-v1-chat", exists("app", "api", "v1", "chat", "route.ts")],
  ["api-v1-models", exists("app", "api", "v1", "models", "route.ts")],
  ["api-v1-providers", exists("app", "api", "v1", "providers", "route.ts")],
  ["api-v1-packages", exists("app", "api", "v1", "packages", "route.ts")],
  ["api-v1-health", exists("app", "api", "v1", "health", "route.ts")],
  ["clerk-callbacks", exists("app", "sso-callback", "page.tsx")],
  ["stripe-checkout", exists("app", "api", "billing", "checkout", "route.ts")],
  ["stripe-webhooks", exists("app", "api", "webhooks", "stripe", "route.ts")],
  ["resend-email", exists("app", "api", "notifications", "route.ts") || exists("lib", "email.ts") || exists("lib", "resend.ts")],
  ["usage-credits", exists("app", "api", "v1", "usage", "route.ts") || exists("app", "dashboard", "usage", "page.tsx")],
  ["m4-fx", exists("app", "dashboard", "admin", "fx-cost-control", "page.tsx") && exists("lib", "fx", "index.ts")],
];

const missing = checks.filter(([, ok]) => !ok).map(([n]) => n);
console.log(
  JSON.stringify(
    {
      checks: Object.fromEntries(checks),
      missing,
      REQUIRED_ROUTES_PRESERVED: missing.length === 0 ? "YES" : "NO",
    },
    null,
    2,
  ),
);
