#!/usr/bin/env node
/**
 * Sprint 29.1 — OpenAI model id mapping tests (no live API calls).
 */
const path = require("path");
const modelConfig = require(path.join(__dirname, "..", "config", "models.js"));

const OPENAI_UI_MODELS = ["gpt-4o", "gpt-4.1", "o1-mini"];

const EXPECTED_API_IDS = {
  "gpt-4o": "gpt-4o",
  "gpt-4.1": "gpt-4.1",
  "o1-mini": "o4-mini",
};

let passed = 0;
let failed = 0;

function assert(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

for (const uiId of OPENAI_UI_MODELS) {
  const apiId = modelConfig.resolveApiId(uiId);
  assert(
    `resolveApiId(${uiId}) → ${EXPECTED_API_IDS[uiId]}`,
    apiId === EXPECTED_API_IDS[uiId],
    `got ${apiId}`
  );
}

assert(
  "o1-mini is a reasoning model",
  modelConfig.isReasoningModel("o1-mini"),
  "expected reasoning flag"
);

assert(
  "gpt-4o is not a reasoning model",
  !modelConfig.isReasoningModel("gpt-4o"),
  "expected non-reasoning"
);

assert(
  "gpt-4.1 is not a reasoning model",
  !modelConfig.isReasoningModel("gpt-4.1"),
  "expected non-reasoning"
);

const openaiModels = modelConfig.getOpenAIModels();
assert(
  "catalog exposes three OpenAI models",
  openaiModels.length === 3,
  `got ${openaiModels.length}`
);

for (const model of openaiModels) {
  assert(
    `${model.id} has apiId`,
    typeof model.apiId === "string" && model.apiId.length > 0,
    "missing apiId"
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
