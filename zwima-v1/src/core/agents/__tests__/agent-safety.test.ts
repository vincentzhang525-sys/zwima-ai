import { describe, expect, it } from "vitest";
import {
  AGENT_RUN_TIMEOUT_MS,
  ALLOWED_TOOL_KEYS,
  FORBIDDEN_TOOL_KEYS,
  MAX_AGENT_INPUT_CHARS,
  MAX_AGENT_STEPS,
  MAX_AGENT_TOOL_CALLS,
  MAX_OUTPUT_TOKENS_CLAMP,
  PER_RUN_COST_CEILING_USD,
  clampOutputTokens,
  isAllowedToolKey,
} from "../agent-safety";

describe("agent-safety constants", () => {
  it("matches the Phase 1 spec values", () => {
    expect(MAX_AGENT_STEPS).toBe(8);
    expect(MAX_AGENT_TOOL_CALLS).toBe(5);
    expect(AGENT_RUN_TIMEOUT_MS).toBe(60_000);
    expect(MAX_AGENT_INPUT_CHARS).toBe(20_000);
  });

  it("clamps output tokens to the max", () => {
    expect(clampOutputTokens(999_999)).toBe(MAX_OUTPUT_TOKENS_CLAMP);
    expect(clampOutputTokens(10)).toBe(10);
    expect(clampOutputTokens(undefined)).toBe(MAX_OUTPUT_TOKENS_CLAMP);
    expect(clampOutputTokens(-5)).toBe(MAX_OUTPUT_TOKENS_CLAMP);
  });

  it("has a positive per-run cost ceiling", () => {
    expect(PER_RUN_COST_CEILING_USD).toBeGreaterThan(0);
  });
});

describe("tool allowlist", () => {
  it("allows the three required Phase 1 core tools", () => {
    expect(isAllowedToolKey("calculator")).toBe(true);
    expect(isAllowedToolKey("current_datetime")).toBe(true);
    expect(isAllowedToolKey("workspace_usage_summary")).toBe(true);
  });

  it("allows the pre-existing safe mock tools", () => {
    expect(isAllowedToolKey("web-search-mock")).toBe(true);
    expect(isAllowedToolKey("document-retrieval-mock")).toBe(true);
    expect(isAllowedToolKey("email-draft-mock")).toBe(true);
  });

  it("rejects every forbidden tool category", () => {
    for (const key of FORBIDDEN_TOOL_KEYS) {
      expect(isAllowedToolKey(key)).toBe(false);
    }
  });

  it("rejects unknown / made-up tool names", () => {
    expect(isAllowedToolKey("delete_database")).toBe(false);
    expect(isAllowedToolKey("")).toBe(false);
    expect(isAllowedToolKey("Calculator")).toBe(false); // case sensitive
  });

  it("allowlist never contains a forbidden key (defense in depth)", () => {
    for (const forbidden of FORBIDDEN_TOOL_KEYS) {
      expect(ALLOWED_TOOL_KEYS.includes(forbidden)).toBe(false);
    }
  });
});
