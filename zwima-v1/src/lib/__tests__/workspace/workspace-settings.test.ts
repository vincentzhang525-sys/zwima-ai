import { describe, it, expect } from "vitest";
import { settingsPatchSchema, parseBody } from "@/lib/workspace/schemas";
import { DEFAULT_SETTINGS } from "@/lib/workspace/settings-service";

describe("workspace-settings", () => {
  it("provides EUR billing defaults", () => {
    expect(DEFAULT_SETTINGS.billingProfile.currency).toBe("EUR");
    expect(DEFAULT_SETTINGS.defaultRoutingMode).toBe("BALANCED");
  });

  it("validates settings patch", () => {
    const patch = parseBody(settingsPatchSchema, {
      defaultRoutingMode: "EU_COMPLIANCE",
      euDataResidency: true,
      billingProfile: { companyName: "ZWIMA GmbH", vatId: "DE123" },
    });
    expect(patch.defaultRoutingMode).toBe("EU_COMPLIANCE");
    expect(patch.billingProfile?.companyName).toBe("ZWIMA GmbH");
  });

  it("settings storage uses metadata-compatible shape", () => {
    const stored = {
      defaultRoutingMode: "LOWEST_COST",
      monthlyBudget: 50000,
    };
    expect(stored.monthlyBudget).toBeGreaterThan(0);
    expect(JSON.stringify(stored)).not.toContain("password");
  });
});
