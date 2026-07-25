import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Sub-processors — ZWIMA AI",
  description:
    "Draft list of ZWIMA AI sub-processors / Unterauftragsverarbeiter. Legal review required before Production.",
};

const LAST_UPDATED = "2026-07-21";

type Row = {
  name: string;
  purpose: string;
  dataCategories: string;
  location: string;
  transfer: string;
  retention: string;
  status: string;
};

const rows: Row[] = [
  {
    name: "Vercel",
    purpose: "Hosting, deployment, edge delivery and application infrastructure",
    dataCategories: "Account-related request data, application logs, technical metadata as required to host the service",
    location: "POLICY_PENDING / LEGAL_REVIEW_REQUIRED",
    transfer: "LEGAL_REVIEW_REQUIRED",
    retention: "POLICY_PENDING",
    status: "In use (platform infrastructure)",
  },
  {
    name: "Supabase",
    purpose: "Database, authentication-related storage where applicable, logs and application data",
    dataCategories: "Application and account data, operational logs, structured platform records",
    location: "POLICY_PENDING / LEGAL_REVIEW_REQUIRED",
    transfer: "LEGAL_REVIEW_REQUIRED",
    retention: "POLICY_PENDING",
    status: "In use (platform data store)",
  },
  {
    name: "Clerk",
    purpose: "User authentication, session management and identity services",
    dataCategories: "Identity, authentication, and session data",
    location: "POLICY_PENDING / LEGAL_REVIEW_REQUIRED",
    transfer: "LEGAL_REVIEW_REQUIRED",
    retention: "POLICY_PENDING",
    status: "In use (identity)",
  },
  {
    name: "Resend (or current email service)",
    purpose: "Transactional email delivery",
    dataCategories: "Email address and message metadata for transactional mail",
    location: "POLICY_PENDING / LEGAL_REVIEW_REQUIRED",
    transfer: "LEGAL_REVIEW_REQUIRED",
    retention: "POLICY_PENDING",
    status: "PENDING until production email provider is confirmed",
  },
  {
    name: "Stripe",
    purpose: "Payments, invoicing and billing",
    dataCategories: "Billing contact and payment-related data as required for charges/invoices",
    location: "POLICY_PENDING / LEGAL_REVIEW_REQUIRED",
    transfer: "LEGAL_REVIEW_REQUIRED",
    retention: "POLICY_PENDING",
    status: "PENDING / not enabled in Production (this launch phase)",
  },
  {
    name: "AI model providers (category)",
    purpose: "AI inference and model processing",
    dataCategories: "Prompts, files, business data, and model outputs submitted via the API when a live call is authorised",
    location: "Provider-specific — POLICY_PENDING / LEGAL_REVIEW_REQUIRED",
    transfer: "LEGAL_REVIEW_REQUIRED (SCC / adequacy / other not finally confirmed)",
    retention: "POLICY_PENDING (also subject to customer instructions where ZWIMA is processor)",
    status:
      "Provider-specific (OpenAI, Google Gemini, Anthropic, DeepSeek, Qwen as current architecture candidates); disabled for real calls while LIVE_PROVIDER_CALLS_ENABLED=false",
  },
];

/**
 * Additive public sub-processors draft (P1.10).
 * Not a signed DPA/SCC annex — LEGAL REVIEW REQUIRED BEFORE PRODUCTION.
 */
export default function SubProcessorsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          LEGAL REVIEW REQUIRED BEFORE PRODUCTION
        </p>
        <p className="mt-2 text-xs text-slate-500">
          This page discloses third parties that may process personal data to operate ZWIMA AI. It does{" "}
          <strong>not</strong> claim that DPAs, SCCs, or counsel sign-off are complete, and it is{" "}
          <strong>not</strong> presented as a final effective legal instrument.
        </p>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Sub-processors</h1>
        <p className="mt-1 text-lg text-slate-600 dark:text-slate-400">Unterauftragsverarbeiter</p>
        <p className="mt-2 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">Purpose of this page</h2>
          <p>
            Zwima Technologie GmbH publishes this draft list so customers can see categories and current architecture
            candidates used to provide the service. Pair with our{" "}
            <Link className="underline" href="/privacy">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link className="underline" href="/legal/dpa">
              DPA
            </Link>
            .
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">AI model providers</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Invoked only when the customer requests them, routing policy allows, and permissions permit</li>
            <li>We do not guarantee that every request is sent to the same provider</li>
            <li>Specific provider, model, version, and processing region should be recorded in operational logs</li>
            <li>Customers may restrict providers or regions where enterprise configuration allows</li>
            <li>
              While <code>LIVE_PROVIDER_CALLS_ENABLED=false</code>, the platform must not make real model calls
            </li>
          </ul>
          <p className="text-xs text-slate-500">
            Current architecture candidates include OpenAI, Google Gemini, Anthropic, DeepSeek, and Qwen — status
            remains provider-specific and disabled for live inference until Live Provider launch is approved.
          </p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">International transfers</h2>
          <p>
            Processing outside the EU/EEA requires an applicable lawful transfer mechanism. SCCs, adequacy decisions, or
            other mechanisms that are not yet confirmed are marked <code>LEGAL_REVIEW_REQUIRED</code>. We do not claim
            that all vendors have completed final legal review.
          </p>
        </section>

        <section className="mt-10 overflow-x-auto">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">Draft inventory</h2>
          <table className="mt-4 w-full min-w-[900px] border-collapse text-left text-xs text-slate-700 dark:text-slate-300">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-3 font-medium">Provider / Sub-processor</th>
                <th className="py-2 pr-3 font-medium">Service purpose</th>
                <th className="py-2 pr-3 font-medium">Data categories</th>
                <th className="py-2 pr-3 font-medium">Location / region</th>
                <th className="py-2 pr-3 font-medium">Transfer mechanism</th>
                <th className="py-2 pr-3 font-medium">Retention notes</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-slate-100 align-top dark:border-slate-800">
                  <td className="py-3 pr-3 font-medium text-slate-900 dark:text-white">{r.name}</td>
                  <td className="py-3 pr-3">{r.purpose}</td>
                  <td className="py-3 pr-3">{r.dataCategories}</td>
                  <td className="py-3 pr-3">{r.location}</td>
                  <td className="py-3 pr-3">{r.transfer}</td>
                  <td className="py-3 pr-3">{r.retention}</td>
                  <td className="py-3">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">Last updated: {LAST_UPDATED}</p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">Change notification policy</h2>
          <p>
            For material additions or replacements of sub-processors, we intend to notify via platform notice and/or the
            registered account email. Notice period: <code>POLICY_PENDING</code>. Enterprise contracts may set a separate
            objection period.
          </p>
        </section>

        <p className="mt-10 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          LEGAL REVIEW REQUIRED BEFORE PRODUCTION
        </p>

        <p className="mt-6 text-xs text-slate-500">
          Related:{" "}
          <Link className="underline" href="/privacy">
            Privacy
          </Link>
          {" · "}
          <Link className="underline" href="/legal/dpa">
            DPA
          </Link>
          {" · "}
          <Link className="underline" href="/terms">
            Terms
          </Link>
          {" · "}
          <Link className="underline" href="/cookies">
            Cookies
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
