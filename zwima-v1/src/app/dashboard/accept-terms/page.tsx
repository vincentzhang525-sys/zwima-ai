"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DPA_VERSION,
  LEGAL_BUNDLE_VERSION,
  LEGAL_DOC_PATHS,
  PRIVACY_VERSION,
  PROVIDER_DISCLOSURE_VERSION,
  TERMS_VERSION,
} from "@/lib/compliance/legal-versions";

export default function AcceptTermsPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAccept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/legal/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to record consent");
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record consent");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
        Accept Closed Beta terms
      </h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
        Before using the dashboard and commercial API, you must accept the current legal
        bundle <code className="text-xs">{LEGAL_BUNDLE_VERSION}</code>.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-slate-700 dark:text-slate-300">
        <li>
          <Link className="underline" href={LEGAL_DOC_PATHS.terms} target="_blank">
            Terms of Service
          </Link>{" "}
          (v{TERMS_VERSION})
        </li>
        <li>
          <Link className="underline" href={LEGAL_DOC_PATHS.privacy} target="_blank">
            Privacy Policy
          </Link>{" "}
          (v{PRIVACY_VERSION})
        </li>
        <li>
          <Link className="underline" href={LEGAL_DOC_PATHS.dpa} target="_blank">
            GDPR / DPA
          </Link>{" "}
          (v{DPA_VERSION})
        </li>
        <li>
          <Link className="underline" href={LEGAL_DOC_PATHS.providerDisclosure} target="_blank">
            Provider data processing &amp; sub-processors
          </Link>{" "}
          (v{PROVIDER_DISCLOSURE_VERSION})
        </li>
      </ul>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={onAccept}
        data-testid="accept-legal-terms"
        className="mt-8 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
      >
        {busy ? "Saving…" : "I accept the current terms"}
      </button>
    </div>
  );
}
