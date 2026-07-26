#!/usr/bin/env node
/**
 * Read-only Lambda/route inventory comparison: Production vs curated Preview.
 * No network, no secrets.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prodInv = JSON.parse(
  fs.readFileSync(path.join(root, "docs/PRODUCTION_ROUTE_CAPABILITY_INVENTORY.json"), "utf8"),
);
const curatedInv = JSON.parse(
  fs.readFileSync(path.join(root, "docs/CURATED_BASELINE_ROUTE_INVENTORY.json"), "utf8"),
);

function normalizeProdPath(p) {
  return String(p)
    .replace(/^\/+/, "")
    .replace(/\.rsc$/, "")
    .replace(/\/$/, "");
}

function normalizeCuratedPath(p) {
  // curated inventory uses Next app-path keys like "/api/v1/providers"
  return String(p)
    .replace(/^\/+/, "")
    .replace(/\/page$/, "")
    .replace(/\/route$/, "")
    .replace(/\.rsc$/, "")
    .replace(/\/$/, "");
}

const prodPaths = new Set();
for (const g of Object.values(prodInv.groups || {})) {
  for (const p of g.paths || []) prodPaths.add(normalizeProdPath(p));
}
if (Array.isArray(prodInv.allUniquePaths)) {
  for (const p of prodInv.allUniquePaths) prodPaths.add(normalizeProdPath(p));
}

const curatedPaths = new Set((curatedInv.routes || []).map(normalizeCuratedPath).filter(Boolean));

function isFrameworkGenerated(p) {
  return (
    p.includes("_next") ||
    p.startsWith("_") ||
    p.includes(".rsc") ||
    /\/_/.test(p) ||
    p === "favicon.ico" ||
    p.endsWith("/favicon.ico")
  );
}

const requiredCapabilities = [
  { name: "home", match: (p) => p === "" || p === "index" || p === "/" },
  { name: "login", match: (p) => p === "login" || p.endsWith("/login") },
  { name: "signup", match: (p) => p === "signup" || p.endsWith("/signup") },
  { name: "forgot-password", match: (p) => p.includes("forgot-password") },
  { name: "dashboard", match: (p) => p === "dashboard" || p.startsWith("dashboard/") },
  { name: "billing", match: (p) => p.includes("billing") || p.includes("balance") || p.includes("wallet") },
  { name: "admin-models", match: (p) => p.includes("admin") && p.includes("model") },
  { name: "admin-providers", match: (p) => p.includes("admin") && p.includes("provider") },
  { name: "agents-api", match: (p) => p.startsWith("api/v1/agents") || p.includes("api/admin/agent") },
  { name: "agents-ui", match: (p) => p.startsWith("dashboard/agents") },
  { name: "api-v1-chat", match: (p) => p === "api/v1/chat" || p.startsWith("api/v1/chat/") },
  { name: "api-v1-models", match: (p) => p === "api/v1/models" || p.startsWith("api/v1/models/") },
  { name: "api-v1-providers", match: (p) => p === "api/v1/providers" || p.startsWith("api/v1/providers/") },
  { name: "api-v1-packages", match: (p) => p === "api/v1/packages" || p.startsWith("api/v1/packages/") },
  { name: "api-v1-health", match: (p) => p === "api/v1/health" || p.startsWith("api/v1/health/") },
  { name: "clerk-callbacks", match: (p) => p.includes("sso-callback") || p.includes("clerk") },
  { name: "stripe-checkout", match: (p) => p.includes("billing/checkout") || p.includes("stripe") },
  { name: "stripe-webhooks", match: (p) => p.includes("webhooks/stripe") || p.includes("webhook") && p.includes("stripe") },
  { name: "resend-email", match: (p) => p.includes("email") || p.includes("resend") || p.includes("notifications") },
  { name: "usage-credits", match: (p) => p.includes("usage") || p.includes("credit") || p.includes("recharge") || p.includes("transactions") },
  { name: "m4-fx", match: (p) => p.includes("fx-cost-control") || p.includes("cost-optimization") || p.includes("fx-") },
];

function presentIn(set, pred) {
  for (const p of set) if (pred(p)) return true;
  return false;
}

const required = requiredCapabilities.map((c) => ({
  name: c.name,
  inProduction: presentIn(prodPaths, c.match),
  inCurated: presentIn(curatedPaths, c.match),
}));

const onlyProd = [...prodPaths].filter((p) => !curatedPaths.has(p) && !isFrameworkGenerated(p));
const onlyCurated = [...curatedPaths].filter((p) => !prodPaths.has(p) && p);

function classify(p) {
  if (isFrameworkGenerated(p)) return "framework_generated";
  if (
    p.includes("workflow") ||
    p.includes("infrastructure") ||
    p.includes("enterprise") ||
    p.includes("dashboard/admin/activity") ||
    p.includes("api/admin/dashboard") ||
    p.includes("api/admin/workflows") ||
    p.includes("api/admin/infrastructure") ||
    p.includes("api/admin/enterprise")
  ) {
    return "intentional_m9_m11_exclusion";
  }
  if (
    p.includes("compliance") ||
    p.includes("lifecycle") ||
    p.includes("routing") ||
    p.includes("ops-dashboard") ||
    p.includes("security-events") ||
    p.includes("model-registry") ||
    p.includes("model-migration") ||
    p.includes("prompts") ||
    p.includes("tools") ||
    p.includes("cost-engine") ||
    p.includes("cost-calculator") ||
    p.includes("margins") ||
    p.includes("revenue") ||
    p.includes("console")
  ) {
    return "admin_or_ops_sprawl_deferred";
  }
  if (
    requiredCapabilities.some((c) => c.match(p)) ||
    p.startsWith("api/v1/") ||
    p.startsWith("dashboard/") ||
    p === "login" ||
    p === "signup"
  ) {
    return "required_or_core_app";
  }
  if (p.includes("playground") || p.includes("analytics") || p.includes("team") || p.includes("notifications")) {
    return "secondary_dashboard_feature";
  }
  return "unknown";
}

const classified = {};
for (const p of onlyProd) {
  const k = classify(p);
  classified[k] = classified[k] || [];
  classified[k].push(p);
}

const missingRequired = required.filter((r) => r.inProduction && !r.inCurated).map((r) => r.name);
const missingRequiredNotInProd = required.filter((r) => !r.inProduction && !r.inCurated).map((r) => r.name);
const unknownGaps = (classified.unknown || []).slice(0, 80);
const requiredAbsentOrUnknown = missingRequired.length > 0;

console.log(
  JSON.stringify(
    {
      productionUniquePaths: prodPaths.size,
      curatedRouteCount: curatedPaths.size,
      productionExtractedPaths: prodInv.totalExtractedPaths,
      productionUniqueAppPaths: prodInv.uniqueApplicationPaths,
      frameworkMarkers: prodInv.frameworkGeneratedPathCount,
      required,
      missingRequiredOnCurated: missingRequired,
      missingOnBoth: missingRequiredNotInProd,
      onlyProdCounts: Object.fromEntries(Object.entries(classified).map(([k, v]) => [k, v.length])),
      unknownSample: unknownGaps,
      intentionalExclusionsSample: (classified.intentional_m9_m11_exclusion || []).slice(0, 40),
      adminSprawlSample: (classified.admin_or_ops_sprawl_deferred || []).slice(0, 40),
      requiredOrCoreOnlyProdSample: (classified.required_or_core_app || []).slice(0, 60),
      failReview: requiredAbsentOrUnknown,
    },
    null,
    2,
  ),
);
