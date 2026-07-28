import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-errors";
import { LEGAL_BUNDLE_VERSION, consentIsCurrent } from "@/lib/compliance/legal-versions";

const findUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    legalConsentAcceptance: {
      findUnique,
      upsert: vi.fn(),
    },
    accountDeletionRequest: {
      create: vi.fn(),
    },
  },
}));

import {
  assertCommercialApiConsent,
  hasCurrentLegalConsent,
} from "@/lib/compliance/legal-consent";

describe("GAP-011 legal consent", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("consentIsCurrent requires exact bundle version", () => {
    expect(consentIsCurrent(LEGAL_BUNDLE_VERSION)).toBe(true);
    expect(consentIsCurrent("old-bundle")).toBe(false);
    expect(consentIsCurrent(null)).toBe(false);
  });

  it("assertCommercialApiConsent fails closed when missing", async () => {
    findUnique.mockResolvedValue(null);
    try {
      await assertCommercialApiConsent("user_1", "req_1");
      expect.unreachable("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("TERMS_NOT_ACCEPTED");
      expect((err as ApiError).status).toBe(403);
    }
  });

  it("assertCommercialApiConsent passes when current bundle accepted", async () => {
    findUnique.mockResolvedValue({ bundleVersion: LEGAL_BUNDLE_VERSION });
    await expect(assertCommercialApiConsent("user_1")).resolves.toBeUndefined();
    await expect(hasCurrentLegalConsent("user_1")).resolves.toBe(true);
  });
});
