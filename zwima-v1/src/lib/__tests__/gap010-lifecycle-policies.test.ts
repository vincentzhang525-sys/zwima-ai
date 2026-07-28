/**
 * GAP-010 — Deprecation / migration policy wiring tests (no email / no Provider / no DB mutate).
 */
import { describe, expect, it } from "vitest";
import { evaluateDeprecationPolicy } from "@/lib/model-lifecycle/deprecation-policy-engine";
import { evaluateMigrationPolicy } from "@/lib/model-lifecycle/migration-policy-engine";
import {
  assertNotificationChannelAllowed,
  dispatchDeprecationNotification,
  planInAppDeprecationNotifications,
} from "@/lib/model-lifecycle/deprecation-notifications";
import {
  buildLifecyclePolicyIndex,
  lookupPolicies,
  policyKey,
  resolveLifecycleRoutingDecision,
} from "@/lib/model-lifecycle/policy-wiring";
import { isRoutableStatus } from "@/lib/model-lifecycle/lifecycle-service";

describe("GAP-010 status gate preserved", () => {
  it("keeps isRoutableStatus fail-closed for DEPRECATED/SUNSET", () => {
    expect(isRoutableStatus("ACTIVE", "production")).toBe(true);
    expect(isRoutableStatus("PREVIEW", "preview")).toBe(true);
    expect(isRoutableStatus("PREVIEW", "production")).toBe(false);
    expect(isRoutableStatus("DEPRECATED", "production")).toBe(false);
    expect(isRoutableStatus("SUNSET", "production")).toBe(false);
  });
});

describe("GAP-010 deprecation policy engine", () => {
  it("excludes DISABLED / RETIRED / DEPRECATED", () => {
    expect(evaluateDeprecationPolicy({ id: "1", status: "DISABLED" }).routable).toBe(false);
    expect(evaluateDeprecationPolicy({ id: "2", status: "RETIRED" }).routable).toBe(false);
    expect(evaluateDeprecationPolicy({ id: "3", status: "DEPRECATED" }).routable).toBe(false);
  });

  it("SUNSET_SCHEDULED excludes only after sunset date", () => {
    const now = new Date("2026-07-29T00:00:00.000Z");
    const future = evaluateDeprecationPolicy(
      {
        id: "s1",
        status: "SUNSET_SCHEDULED",
        sunsetDate: new Date("2026-08-01T00:00:00.000Z"),
        replacementModelCode: "gpt-new",
      },
      now,
    );
    expect(future.routable).toBe(true);
    expect(future.announced).toBe(true);
    expect(future.replacementModelCode).toBe("gpt-new");

    const past = evaluateDeprecationPolicy(
      {
        id: "s2",
        status: "SUNSET_SCHEDULED",
        sunsetDate: new Date("2026-07-01T00:00:00.000Z"),
      },
      now,
    );
    expect(past.routable).toBe(false);
    expect(past.excludeReason).toMatch(/sunset/i);
  });

  it("DEPRECATION_ANNOUNCED remains routable", () => {
    const r = evaluateDeprecationPolicy({
      id: "a1",
      status: "DEPRECATION_ANNOUNCED",
      customerMessage: "Please migrate",
    });
    expect(r.routable).toBe(true);
    expect(r.announced).toBe(true);
  });
});

describe("GAP-010 migration policy engine", () => {
  it("rewrites when autoMigrate ACTIVE and model matches", () => {
    const r = evaluateMigrationPolicy(
      {
        id: "m1",
        fromModelCode: "gpt-old",
        toModelCode: "gpt-new",
        autoMigrate: true,
        enabled: true,
        status: "ACTIVE",
        requireHumanApproval: false,
      },
      "gpt-old",
    );
    expect(r.applied).toBe(true);
    expect(r.rewriteModelCode).toBe("gpt-new");
  });

  it("skips when human approval required or autoMigrate off", () => {
    expect(
      evaluateMigrationPolicy(
        {
          id: "m2",
          fromModelCode: "a",
          toModelCode: "b",
          autoMigrate: true,
          enabled: true,
          status: "ACTIVE",
          requireHumanApproval: true,
        },
        "a",
      ).skipReason,
    ).toBe("requires_human_approval");
    expect(
      evaluateMigrationPolicy(
        {
          id: "m3",
          fromModelCode: "a",
          toModelCode: "b",
          autoMigrate: false,
          enabled: true,
          status: "ACTIVE",
          requireHumanApproval: false,
        },
        "a",
      ).applied,
    ).toBe(false);
  });
});

describe("GAP-010 combined wiring", () => {
  it("status gate blocks before policy rewrite", () => {
    const d = resolveLifecycleRoutingDecision({
      modelStatus: "DEPRECATED",
      modelCode: "gpt-old",
      vercelEnv: "production",
      migrationPolicy: {
        id: "m",
        fromModelCode: "gpt-old",
        toModelCode: "gpt-new",
        autoMigrate: true,
        enabled: true,
        status: "ACTIVE",
        requireHumanApproval: false,
      },
    });
    expect(d.routable).toBe(false);
    expect(d.migrationApplied).toBe(false);
  });

  it("applies auto-migrate rewrite for ACTIVE models", () => {
    const d = resolveLifecycleRoutingDecision({
      modelStatus: "ACTIVE",
      modelCode: "gpt-old",
      vercelEnv: "production",
      migrationPolicy: {
        id: "m",
        fromModelCode: "gpt-old",
        toModelCode: "gpt-new",
        autoMigrate: true,
        enabled: true,
        status: "ACTIVE",
        requireHumanApproval: false,
      },
    });
    expect(d.routable).toBe(true);
    expect(d.migrationApplied).toBe(true);
    expect(d.effectiveModelCode).toBe("gpt-new");
  });

  it("indexes policies by provider+model key", () => {
    const index = buildLifecyclePolicyIndex({
      deprecations: [{ id: "d1", status: "DISABLED" }],
      migrations: [
        {
          id: "m1",
          fromModelCode: "old",
          toModelCode: "neu",
          autoMigrate: true,
          enabled: true,
          status: "ACTIVE",
          requireHumanApproval: false,
        },
      ],
      deprecationKeys: [policyKey("openai", "old")],
      migrationFromKeys: [policyKey("openai", "old")],
    });
    const found = lookupPolicies(index, "openai", "old");
    expect(found.deprecationPolicy?.status).toBe("DISABLED");
    expect(found.migrationPolicy?.toModelCode).toBe("neu");
    expect(lookupPolicies(index, "gemini", "old").deprecationPolicy).toBeNull();
  });
});

describe("GAP-010 notifications fail-closed for email", () => {
  it("refuses EMAIL channel assert and dispatch", () => {
    expect(() => assertNotificationChannelAllowed("EMAIL")).toThrow(/EMAIL_FORBIDDEN/);
    const refused = dispatchDeprecationNotification({
      channel: "EMAIL",
      notificationType: "ANNOUNCEMENT",
    });
    expect(refused.delivered).toBe(false);
    expect(refused.mode).toBe("REFUSED");
  });

  it("plans IN_APP notifications only", () => {
    const planned = planInAppDeprecationNotifications({
      announcementDate: new Date("2026-07-29T00:00:00.000Z"),
      sunsetDate: new Date("2026-08-30T00:00:00.000Z"),
      now: new Date("2026-07-29T12:00:00.000Z"),
    });
    expect(planned.length).toBeGreaterThan(0);
    expect(planned.every((p) => p.channel === "IN_APP")).toBe(true);
    const delivered = dispatchDeprecationNotification({
      channel: "IN_APP",
      notificationType: "ANNOUNCEMENT",
    });
    expect(delivered.delivered).toBe(true);
    expect(delivered.mode).toBe("IN_APP_RECORDED");
  });
});
