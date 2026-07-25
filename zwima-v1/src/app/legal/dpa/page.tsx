import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Data Processing Agreement — ZWIMA AI",
  description: "Customer DPA draft for ZWIMA AI (Art. 28-style). Legal review required before Production.",
};

/**
 * Additive public legal page (P1.6). Draft — LEGAL REVIEW REQUIRED BEFORE PRODUCTION.
 */
export default function DpaPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          LEGAL REVIEW REQUIRED BEFORE PRODUCTION
        </p>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Data Processing Agreement
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Provider: Zwima Technologie GmbH, Dormagener Straße 2 e, 41468 Neuss, Germany. Contact:{" "}
          <a className="underline" href="mailto:hello@zwima-group.info">
            hello@zwima-group.info
          </a>
        </p>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">1. Roles by scenario</h2>

          <h3 className="font-medium text-slate-900 dark:text-white">1.1 Customer API content (Controller / Processor)</h3>
          <p>
            For prompts, files, business data, and model outputs that you submit to or receive through the ZWIMA API:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>You (the customer)</strong> are the <strong>Data Controller</strong>.
            </li>
            <li>
              <strong>Zwima Technologie GmbH</strong> is the <strong>Data Processor</strong>.
            </li>
            <li>ZWIMA processes such data only on your documented instructions.</li>
          </ul>

          <h3 className="mt-4 font-medium text-slate-900 dark:text-white">
            1.2 Platform operations data (ZWIMA as independent Controller)
          </h3>
          <p>Zwima Technologie GmbH is an independent Data Controller for:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>User account and contact information</li>
            <li>Subscription, order, payment, and invoice information</li>
            <li>Security logs, abuse prevention, fraud/risk controls, and audit records</li>
            <li>Legal compliance and tax retention data</li>
          </ul>
          <p className="text-slate-600 dark:text-slate-400">
            Account and billing data are <strong>not</strong> controlled by the customer under this DPA.
          </p>

          <h3 className="mt-4 font-medium text-slate-900 dark:text-white">1.3 Sub-processors</h3>
          <p>
            Upstream model providers, cloud hosting, email, identity authentication, and database vendors are managed in
            principle as ZWIMA&apos;s sub-processors. See the public draft list:{" "}
            <Link className="underline" href="/legal/sub-processors">
              Sub-processors
            </Link>
            . Binding annexes and transfer mechanisms remain subject to LEGAL review before Production.
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">2. Topics this DPA covers</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Subject matter, duration, nature, and purpose of processing</li>
            <li>Types of personal data and categories of data subjects</li>
            <li>Processing only on documented customer instructions</li>
            <li>Confidentiality obligations</li>
            <li>Technical and organisational security measures (TOMs)</li>
            <li>Sub-processor list and change notification</li>
            <li>Assistance with data subject requests</li>
            <li>Personal data breach notification</li>
            <li>Deletion or return of data</li>
            <li>Audit and compliance evidence</li>
            <li>International data transfer mechanisms</li>
            <li>Processing after contract termination</li>
          </ol>
          <p className="text-xs text-slate-500">
            Full contractual clauses, annexes (TOMs, sub-processors, SCCs), and signatures are pending legal counsel.
            See also the draft file in the repository under <code>docs/legal-drafts/DPA.DRAFT.md</code>.
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">3. Related pages</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <Link className="underline" href="/cookies">
                Cookies
              </Link>
            </li>
            <li>
              <Link className="underline" href="/legal/sub-processors">
                Sub-processors
              </Link>
            </li>
            <li>
              <Link className="underline" href="/privacy">
                Privacy Policy
              </Link>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
