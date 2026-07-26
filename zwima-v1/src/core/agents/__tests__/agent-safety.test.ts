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
import { validateToolRequest } from "../agent-validator";
import { AgentServiceError } from "@/lib/agents/errors";
import { runMockTool } from "@/lib/agents/mock-tools";

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

describe("Phase 1 tool allowlist exact set", () => {
  it("ALLOWED_TOOL_KEYS equals exactly the three frozen Phase 1 tools", () => {
    expect([...ALLOWED_TOOL_KEYS].sort()).toEqual(
      ["calculator", "current_datetime", "workspace_usage_summary"].sort(),
    );
    expect(ALLOWED_TOOL_KEYS).toHaveLength(3);
  });

  it("allows only the three required Phase 1 tools", () => {
    expect(isAllowedToolKey("calculator")).toBe(true);
    expect(isAllowedToolKey("current_datetime")).toBe(true);
    expect(isAllowedToolKey("workspace_usage_summary")).toBe(true);
  });

  it("rejects former Phase 2 mock tools that must not be Phase 1 executable", () => {
    expect(isAllowedToolKey("web-search-mock")).toBe(false);
    expect(isAllowedToolKey("document-retrieval-mock")).toBe(false);
    expect(isAllowedToolKey("email-draft-mock")).toBe(false);
  });

  it("rejects every forbidden tool category", () => {
    for (const key of FORBIDDEN_TOOL_KEYS) {
      expect(isAllowedToolKey(key)).toBe(false);
    }
  });

  it("rejects unknown / made-up tool names", () => {
    expect(isAllowedToolKey("delete_database")).toBe(false);
    expect(isAllowedToolKey("")).toBe(false);
    expect(isAllowedToolKey("Calculator")).toBe(false);
  });

  it("allowlist never contains a forbidden key (defense in depth)", () => {
    for (const forbidden of FORBIDDEN_TOOL_KEYS) {
      expect((ALLOWED_TOOL_KEYS as readonly string[]).includes(forbidden)).toBe(false);
    }
  });
});

describe("Phase 1 tool allowlist negative acceptance", () => {
  const rejected = [
    "web-search-mock",
    "document-retrieval-mock",
    "email-draft-mock",
    "shell",
    "arbitrary-http",
    "filesystem-write",
    "raw-sql",
    "email-send",
    "payment",
  ] as const;

  it("validateToolRequest rejects every negative case", () => {
    for (const key of rejected) {
      expect(() => validateToolRequest(key)).toThrow(AgentServiceError);
      try {
        validateToolRequest(key);
      } catch (err) {
        expect((err as AgentServiceError).code).toBe("TOOL_NOT_ALLOWED");
        expect((err as AgentServiceError).status).toBe(403);
      }
    }
  });

  it("runMockTool rejects Phase 2 reserved mocks and does not execute them", async () => {
    await expect(runMockTool("web-search-mock", { query: "x" })).rejects.toMatchObject({
      code: "TOOL_NOT_ALLOWED",
      status: 403,
    });
    await expect(runMockTool("document-retrieval-mock", { query: "x" })).rejects.toMatchObject({
      code: "TOOL_NOT_ALLOWED",
      status: 403,
    });
    await expect(runMockTool("email-draft-mock", { to: "a@b.c", subject: "s", body: "b" })).rejects.toMatchObject({
      code: "TOOL_NOT_ALLOWED",
      status: 403,
    });
  });
});
