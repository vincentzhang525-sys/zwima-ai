/**
 * GAP-011 Closed Beta legal consent versions + ledger helpers.
 * No secrets logged. Preview DB only for migrations.
 */

export const LEGAL_BUNDLE_VERSION = "2026-07-28-cb1";
export const TERMS_VERSION = "2026-07-28";
export const PRIVACY_VERSION = "2026-07-28";
export const DPA_VERSION = "2026-07-28";
export const PROVIDER_DISCLOSURE_VERSION = "2026-07-28";

export const LEGAL_DOC_PATHS = {
  terms: "/terms",
  privacy: "/privacy",
  dpa: "/legal/dpa",
  providerDisclosure: "/legal/sub-processors",
  cookies: "/cookies",
} as const;

export type LegalVersionSnapshot = {
  bundleVersion: string;
  termsVersion: string;
  privacyVersion: string;
  dpaVersion: string;
  providerDisclosureVersion: string;
};

export function currentLegalVersions(): LegalVersionSnapshot {
  return {
    bundleVersion: LEGAL_BUNDLE_VERSION,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    dpaVersion: DPA_VERSION,
    providerDisclosureVersion: PROVIDER_DISCLOSURE_VERSION,
  };
}

export function consentIsCurrent(acceptedBundleVersion: string | null | undefined): boolean {
  return Boolean(acceptedBundleVersion && acceptedBundleVersion === LEGAL_BUNDLE_VERSION);
}
