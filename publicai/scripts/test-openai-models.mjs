#!/usr/bin/env node
/**
 * Sprint 29.1 — live OpenAI Playground model verification.
 * Usage: node scripts/test-openai-models.mjs [baseUrl]
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const modelConfig = require("../config/models.js");

const baseUrl = (process.argv[2] || "https://zwima-ai.vercel.app").replace(/\/$/, "");
const models = modelConfig.getOpenAIModels();

const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`PASS  ${name}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function testModel(model) {
  const label = `${model.displayName} (${model.id} → ${model.apiId || model.id})`;
  const reasoning = modelConfig.isReasoningModel(model.id);
  const res = await fetch(`${baseUrl}/api/openai-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model.id,
      prompt: reasoning ? "Reply with exactly: OK" : "Reply with exactly: OK",
      maxTokens: reasoning ? 1024 : 32,
      temperature: 0,
    }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    fail(label, json.error || `HTTP ${res.status}`);
    return;
  }

  const content = String(json.content || "").trim();
  if (!content) {
    fail(label, "empty response content");
    return;
  }

  const apiModel = json.model || "";
  if (model.apiId && apiModel && !apiModel.includes(model.apiId.split("-")[0])) {
    console.log(`      note: API returned model=${apiModel}`);
  }

  pass(`${label} — ${content.slice(0, 40)}`);
}

async function main() {
  console.log(`\n=== OpenAI model verify — ${baseUrl} ===\n`);

  for (const model of models) {
    await testModel(model);
  }

  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n${ok} passed, ${bad} failed\n`);
  process.exit(bad ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
