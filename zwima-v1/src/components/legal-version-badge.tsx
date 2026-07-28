import {
  DPA_VERSION,
  LEGAL_BUNDLE_VERSION,
  PRIVACY_VERSION,
  PROVIDER_DISCLOSURE_VERSION,
  TERMS_VERSION,
} from "@/lib/compliance/legal-versions";

type Doc = "privacy" | "terms" | "dpa" | "provider";

const DOC_VERSION: Record<Doc, string> = {
  privacy: PRIVACY_VERSION,
  terms: TERMS_VERSION,
  dpa: DPA_VERSION,
  provider: PROVIDER_DISCLOSURE_VERSION,
};

/** Visible version marker for Closed Beta compliance pages (GAP-011). */
export function LegalVersionBadge({ doc }: { doc: Doc }) {
  const version = DOC_VERSION[doc];
  return (
    <p
      className="mt-2 text-xs text-slate-500"
      data-testid={`legal-version-${doc}`}
      data-legal-bundle={LEGAL_BUNDLE_VERSION}
      data-legal-doc-version={version}
    >
      Closed Beta legal version: bundle <code>{LEGAL_BUNDLE_VERSION}</code> · document{" "}
      <code>{version}</code>
    </p>
  );
}
