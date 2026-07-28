#!/usr/bin/env node
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.log(JSON.stringify({ ok: false, error: "file_required" }));
  process.exit(1);
}

const map = {};
for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq <= 0) continue;
  let v = line.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  map[line.slice(0, eq).trim()] = v;
}

function kind(name, raw) {
  const v = String(raw ?? "").trim();
  if (!v) return "missing";
  if (v === "[SENSITIVE]") return "SENSITIVE";
  if (name === "CLOSED_BETA_STRIPE_TEST_ONLY") return v === "true" ? "true" : `other_value`;
  if (v.startsWith("sk_test_")) return "sk_test";
  if (v.startsWith("sk_live_")) return "sk_live";
  if (v.startsWith("pk_test_")) return "pk_test";
  if (v.startsWith("pk_live_")) return "pk_live";
  if (v.startsWith("whsec_")) return "whsec";
  return "other";
}

const names = [
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CLOSED_BETA_STRIPE_TEST_ONLY",
];

const checks = names.map((name) => {
  const k = kind(name, map[name]);
  const expected =
    name === "STRIPE_SECRET_KEY"
      ? "sk_test"
      : name === "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
        ? "pk_test"
        : name === "STRIPE_WEBHOOK_SECRET"
          ? "whsec"
          : "true";
  return { name, kind: k, ok: k === expected };
});

const allOk = checks.every((c) => c.ok);
console.log(JSON.stringify({ allOk, checks, failed: checks.filter((c) => !c.ok).map((c) => c.name) }, null, 2));
process.exit(allOk ? 0 : 2);
