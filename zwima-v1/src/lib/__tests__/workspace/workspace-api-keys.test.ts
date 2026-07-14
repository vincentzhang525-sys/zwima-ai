import { describe, it, expect } from "vitest";
import { serializeWorkspaceKey } from "@/lib/workspace/api-keys-workspace";
import { createApiKeySchema, revokeApiKeySchema, parseBody } from "@/lib/workspace/schemas";

describe("workspace-api-keys", () => {
  it("masks API key prefix in serialized output", () => {
    const serialized = serializeWorkspaceKey({
      id: "k1",
      name: "Prod",
      prefix: "sk_live_abcdefghijklmnop",
      enabled: true,
      status: "ACTIVE",
      permission: "FULL",
      usageCount: 0,
      expiresAt: null,
      createdAt: new Date(),
      lastUsed: null,
      metadata: { projectId: "p1", routingMode: "BALANCED" },
    });
    expect(serialized.prefix).not.toBe("sk_live_abcdefghijklmnop");
    expect(serialized.prefix).toContain("…");
    expect(serialized.routingMode).toBe("BALANCED");
  });

  it("defaults routing mode to BALANCED", () => {
    const body = parseBody(createApiKeySchema, { name: "Key" });
    expect(body.routingMode ?? "BALANCED").toBe("BALANCED");
  });

  it("requires confirm for revoke", () => {
    expect(() => parseBody(revokeApiKeySchema, { confirm: false })).toThrow();
    const ok = parseBody(revokeApiKeySchema, { confirm: true, reason: "compromised" });
    expect(ok.confirm).toBe(true);
  });

  it("serialized key never includes keyHash or full key", () => {
    const serialized = serializeWorkspaceKey({
      id: "k1",
      name: "Prod",
      prefix: "sk_live_test",
      enabled: true,
      status: "ACTIVE",
      permission: "FULL",
      usageCount: 0,
      expiresAt: null,
      createdAt: new Date(),
      lastUsed: null,
    });
    expect(JSON.stringify(serialized)).not.toContain("keyHash");
    expect(JSON.stringify(serialized)).not.toMatch(/sk_live_[A-Za-z0-9]{20,}/);
  });
});
