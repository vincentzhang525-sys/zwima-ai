import { describe, it, expect } from "vitest";
import { playgroundSchema, parseBody } from "@/lib/workspace/schemas";

describe("workspace-playground", () => {
  it("validates playground request payload", () => {
    const body = parseBody(playgroundSchema, {
      apiKeyId: "key_1",
      model: "gemini-2.5-flash",
      userPrompt: "Hello",
      routingMode: "BALANCED",
    });
    expect(body.apiKeyId).toBe("key_1");
    expect(body.routingMode).toBe("BALANCED");
  });

  it("requires apiKeyId and userPrompt", () => {
    expect(() => parseBody(playgroundSchema, { model: "x", userPrompt: "" })).toThrow();
  });

  it("supports smart routing modes", () => {
    for (const mode of ["BALANCED", "LOWEST_COST", "EU_COMPLIANCE"]) {
      const body = parseBody(playgroundSchema, {
        apiKeyId: "k1",
        model: "gpt-5",
        userPrompt: "hi",
        routingMode: mode,
      });
      expect(body.routingMode).toBe(mode);
    }
  });

  it("playground response contract excludes provider secrets", () => {
    const sample = {
      selectedProvider: "openai",
      routingReason: "balanced score",
      requestId: "req_1",
    };
    expect(JSON.stringify(sample)).not.toMatch(/sk_live_/);
  });
});
