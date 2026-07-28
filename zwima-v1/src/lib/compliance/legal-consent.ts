import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-errors";
import {
  consentIsCurrent,
  currentLegalVersions,
  LEGAL_BUNDLE_VERSION,
} from "@/lib/compliance/legal-versions";

export type ConsentStatus = {
  required: true;
  accepted: boolean;
  bundleVersion: string;
  acceptedAt: string | null;
  acceptedBundleVersion: string | null;
  documents: ReturnType<typeof currentLegalVersions>;
};

export async function getConsentStatus(userId: string): Promise<ConsentStatus> {
  const versions = currentLegalVersions();
  const row = await prisma.legalConsentAcceptance.findUnique({
    where: {
      userId_bundleVersion: { userId, bundleVersion: LEGAL_BUNDLE_VERSION },
    },
  });
  return {
    required: true,
    accepted: Boolean(row),
    bundleVersion: LEGAL_BUNDLE_VERSION,
    acceptedAt: row?.acceptedAt?.toISOString() ?? null,
    acceptedBundleVersion: row?.bundleVersion ?? null,
    documents: versions,
  };
}

export async function hasCurrentLegalConsent(userId: string): Promise<boolean> {
  const row = await prisma.legalConsentAcceptance.findUnique({
    where: {
      userId_bundleVersion: { userId, bundleVersion: LEGAL_BUNDLE_VERSION },
    },
    select: { bundleVersion: true },
  });
  return consentIsCurrent(row?.bundleVersion);
}

export async function assertCommercialApiConsent(
  userId: string,
  requestId?: string,
): Promise<void> {
  const ok = await hasCurrentLegalConsent(userId);
  if (!ok) {
    throw new ApiError(
      "TERMS_NOT_ACCEPTED",
      "Current legal terms must be accepted before using the commercial API.",
      403,
      requestId,
    );
  }
}

export async function recordLegalConsent(params: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
  source?: string;
}) {
  const versions = currentLegalVersions();
  const ipHash = params.ip
    ? createHash("sha256").update(params.ip).digest("hex").slice(0, 32)
    : null;

  return prisma.legalConsentAcceptance.upsert({
    where: {
      userId_bundleVersion: {
        userId: params.userId,
        bundleVersion: versions.bundleVersion,
      },
    },
    create: {
      userId: params.userId,
      bundleVersion: versions.bundleVersion,
      termsVersion: versions.termsVersion,
      privacyVersion: versions.privacyVersion,
      dpaVersion: versions.dpaVersion,
      providerDisclosureVersion: versions.providerDisclosureVersion,
      ipHash,
      userAgent: params.userAgent?.slice(0, 500) ?? null,
      source: params.source ?? "dashboard",
    },
    update: {
      acceptedAt: new Date(),
      ipHash,
      userAgent: params.userAgent?.slice(0, 500) ?? null,
      source: params.source ?? "dashboard",
    },
  });
}

export async function createAccountDeletionRequest(params: {
  userId: string;
  reason?: string | null;
}) {
  return prisma.accountDeletionRequest.create({
    data: {
      userId: params.userId,
      reason: params.reason?.slice(0, 2000) ?? null,
      status: "PENDING_MANUAL_REVIEW",
    },
  });
}
