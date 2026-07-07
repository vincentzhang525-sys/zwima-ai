#!/usr/bin/env node
/**
 * Live provider verification for production Playground routes.
 * Usage: node scripts/test-providers-live.mjs [baseUrl]
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const modelConfig = require("../config/models.js");

const baseUrl = (process.argv[2] || "https://zwima-group.info").replace(/\/$/, "");

const CASES = [
  { provider: "openai", model: "gpt-4o", route: "/api/openai-chat" },
  { provider: "anthropic", model: "claude-4-sonnet", route: "/api/anthropic-chat" },
  { provider: "google", model: "gemini-2-flash", route: "/api/gemini-chat" },
  { provider: "deepseek", model: "deepseek-chat", route: "/api/deepseek-chat" },
];

function ok(name) {
  console.log(`PASS  ${name}`);
}

function bad(name, detail) {
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function runCase(item) {
  const apiModel = modelConfig.resolveApiId(item.model);
  const label = `${item.provider} ${item.model} -> ${apiModel}`;

  const res = await fetch(`${baseUrl}${item.route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: item.model,
      prompt: "Reply with exactly: OK",
      maxTokens: item.provider === "openai" ? 64 : 256,
      temperature: 0,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    bad(label, json.error || `HTTP ${res.status}`);
    return false;
  }

  const content = String(json.content || "").trim();
  if (!content) {
    bad(label, "empty content");
    return false;
  }

  ok(`${label} — ${content.slice(0, 40)}`);
  return true;
}

async function main() {
  console.log(`\n=== Provider verify — ${baseUrl} ===\n`);
  let pass = 0;
  let fail = 0;

  for (const item of CASES) {
    // eslint-disable-next-line no-await-in-loop
    const done = await runCase(item);
    if (done) pass += 1;
    else fail += 1;
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
