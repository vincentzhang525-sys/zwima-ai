#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, ".next/app-path-routes-manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("Missing .next/app-path-routes-manifest.json — run build first");
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const routes = Object.keys(manifest).sort();
const groups = {
  agents_apis: [],
  health: [],
  packages: [],
  billing: [],
  auth_pages: [],
  admin: [],
  dashboard: [],
  m4_fx: [],
  other_api: [],
  pages: [],
};
for (const r of routes) {
  if (r.includes("/api/v1/agents") || r.includes("/api/admin/agent")) groups.agents_apis.push(r);
  else if (r.includes("/api/v1/health")) groups.health.push(r);
  else if (r.includes("/api/v1/packages")) groups.packages.push(r);
  else if (r.includes("billing") || r.includes("stripe") || r.includes("recharge")) groups.billing.push(r);
  else if (/\/(login|signup|forgot-password|sso-callback)/.test(r)) groups.auth_pages.push(r);
  else if (r.includes("fx-cost-control") || r.includes("cost-optimization")) groups.m4_fx.push(r);
  else if (r.includes("/admin")) groups.admin.push(r);
  else if (r.includes("/dashboard")) groups.dashboard.push(r);
  else if (r.includes("/api/")) groups.other_api.push(r);
  else groups.pages.push(r);
}

const out = {
  generatedAt: new Date().toISOString(),
  source: "curated local next build (.next/app-path-routes-manifest.json)",
  branch: "production-baseline-curated",
  baseCommit: "0157570f27106c394537da95faeff0999a18f17f",
  routeCount: routes.length,
  groups: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, { count: v.length, paths: v }])),
  routes,
};
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/CURATED_BASELINE_ROUTE_INVENTORY.json"), JSON.stringify(out, null, 2));
const md = [
  "# Curated Baseline Route Inventory",
  "",
  `**Generated:** ${out.generatedAt}`,
  `**Source:** local production build of branch \`production-baseline-curated\``,
  `**Base:** \`${out.baseCommit}\``,
  `**Route count:** ${out.routeCount}`,
  "",
  "## Groups",
  "",
];
for (const [k, g] of Object.entries(out.groups)) {
  md.push(`### ${k} (${g.count})`, "");
  for (const p of g.paths.slice(0, 80)) md.push(`- \`${p}\``);
  if (g.paths.length > 80) md.push(`- … +${g.paths.length - 80} more`);
  md.push("");
}
fs.writeFileSync(path.join(root, "docs/CURATED_BASELINE_ROUTE_INVENTORY.md"), md.join("\n"));
console.log("WROTE docs/CURATED_BASELINE_ROUTE_INVENTORY.* routes=" + routes.length);
