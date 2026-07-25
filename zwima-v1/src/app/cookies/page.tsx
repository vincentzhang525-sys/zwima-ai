import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Cookies — ZWIMA AI",
  description: "Cookie information for ZWIMA AI (strictly necessary cookies only on V1).",
};

/**
 * Additive public legal page (P1.5). Draft policy — LEGAL REVIEW REQUIRED BEFORE PRODUCTION.
 * No cookie consent banner on V1 (necessary cookies only).
 */
export default function CookiesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          LEGAL REVIEW REQUIRED BEFORE PRODUCTION
        </p>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Cookies</h1>
        <p className="mt-2 text-sm text-slate-500">
          Controller: Zwima Technologie GmbH, Dormagener Straße 2 e, 41468 Neuss, Germany. Contact:{" "}
          <a className="underline" href="mailto:hello@zwima-group.info">
            hello@zwima-group.info
          </a>
        </p>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">V1 cookie policy</h2>
          <p>
            On V1 we use <strong>strictly necessary cookies only</strong>. We do <strong>not</strong> use analytics or
            marketing cookies.
          </p>
          <p>
            V1 does <strong>not</strong> display an Accept/Reject cookie consent banner. If we introduce non-essential
            cookies in the future, we will obtain your consent <strong>before</strong> enabling them (for example via a
            consent management banner).
          </p>
          <p>You can manage or delete cookies in your browser settings. Blocking necessary cookies may break sign-in.</p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">Not used on V1</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Google Analytics</li>
            <li>Meta Pixel</li>
            <li>LinkedIn Insight Tag</li>
            <li>Ad retargeting or behavioural tracking</li>
            <li>Hotjar, Microsoft Clarity, or similar third-party analytics</li>
            <li>Non-essential third-party marketing cookies</li>
          </ul>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">Allowed on V1</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Clerk authentication and session cookies</li>
            <li>Security, anti-abuse, and CSRF-related cookies required for the service</li>
            <li>Cookies required for a feature you explicitly request (e.g. staying signed in)</li>
            <li>Necessary load-balancing and technical runtime cookies from the hosting stack</li>
          </ul>
        </section>

        <section className="mt-10 overflow-x-auto">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">Cookie table (V1)</h2>
          <p className="mt-2 text-xs text-slate-500">
            Names and retention may vary with Clerk/hosting configuration. This table is a transparency draft —
            LEGAL REVIEW REQUIRED BEFORE PRODUCTION.
          </p>
          <table className="mt-4 w-full min-w-[640px] border-collapse text-left text-xs text-slate-700 dark:text-slate-300">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Provider</th>
                <th className="py-2 pr-3 font-medium">Purpose</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Retention</th>
                <th className="py-2 pr-3 font-medium">Party</th>
                <th className="py-2 pr-3 font-medium">Legal basis (draft)</th>
                <th className="py-2 font-medium">Consent?</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-3 font-mono">__session</td>
                <td className="py-2 pr-3">Clerk</td>
                <td className="py-2 pr-3">App authenticated session</td>
                <td className="py-2 pr-3">Strictly Necessary</td>
                <td className="py-2 pr-3">Session / Clerk session lifetime</td>
                <td className="py-2 pr-3">First-party</td>
                <td className="py-2 pr-3">Art. 6(1)(b)/(f) GDPR (LEGAL)</td>
                <td className="py-2">No</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-3 font-mono">__client_uat</td>
                <td className="py-2 pr-3">Clerk</td>
                <td className="py-2 pr-3">Client auth timestamp / coordination</td>
                <td className="py-2 pr-3">Strictly Necessary</td>
                <td className="py-2 pr-3">Per Clerk client settings</td>
                <td className="py-2 pr-3">First-party</td>
                <td className="py-2 pr-3">Art. 6(1)(b)/(f) (LEGAL)</td>
                <td className="py-2">No</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-3 font-mono">__clerk_db_jwt*</td>
                <td className="py-2 pr-3">Clerk</td>
                <td className="py-2 pr-3">Device/browser JWT for Clerk client</td>
                <td className="py-2 pr-3">Strictly Necessary</td>
                <td className="py-2 pr-3">Per Clerk settings</td>
                <td className="py-2 pr-3">First-party</td>
                <td className="py-2 pr-3">Art. 6(1)(b)/(f) (LEGAL)</td>
                <td className="py-2">No</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-3 font-mono">__refresh_*</td>
                <td className="py-2 pr-3">Clerk</td>
                <td className="py-2 pr-3">Session refresh</td>
                <td className="py-2 pr-3">Strictly Necessary</td>
                <td className="py-2 pr-3">Per Clerk refresh policy</td>
                <td className="py-2 pr-3">First-party</td>
                <td className="py-2 pr-3">Art. 6(1)(b)/(f) (LEGAL)</td>
                <td className="py-2">No</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-3 font-mono">clerk_active_context</td>
                <td className="py-2 pr-3">Clerk</td>
                <td className="py-2 pr-3">Active Clerk / organisation context</td>
                <td className="py-2 pr-3">Strictly Necessary</td>
                <td className="py-2 pr-3">Session / Clerk policy</td>
                <td className="py-2 pr-3">First-party</td>
                <td className="py-2 pr-3">Art. 6(1)(b)/(f) (LEGAL)</td>
                <td className="py-2">No</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-3">Hosting / edge technical (if set)</td>
                <td className="py-2 pr-3">Hosting provider</td>
                <td className="py-2 pr-3">Routing stability, security, edge protection</td>
                <td className="py-2 pr-3">Strictly Necessary</td>
                <td className="py-2 pr-3">Short-lived / provider default</td>
                <td className="py-2 pr-3">First-party or provider on our domain</td>
                <td className="py-2 pr-3">Art. 6(1)(f) (LEGAL)</td>
                <td className="py-2">No</td>
              </tr>
            </tbody>
          </table>
        </section>

        <p className="mt-10 text-sm text-slate-500">
          Related:{" "}
          <Link className="underline" href="/privacy">
            Privacy
          </Link>
          {" · "}
          <Link className="underline" href="/terms">
            Terms
          </Link>
          {" · "}
          <Link className="underline" href="/legal/dpa">
            DPA
          </Link>
          {" · "}
          <Link className="underline" href="/legal/sub-processors">
            Sub-processors
          </Link>
          {" · "}
          <Link className="underline" href="/imprint">
            Imprint
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
