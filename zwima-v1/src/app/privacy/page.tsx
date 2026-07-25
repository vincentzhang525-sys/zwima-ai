import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Privacy Policy — ZWIMA AI",
  description: "Privacy Policy / Datenschutzerklärung draft for Zwima Technologie GmbH. Legal review required before Production.",
};

/**
 * Additive public Privacy Policy draft (P1.8).
 * Not final legal text — LEGAL REVIEW REQUIRED BEFORE PRODUCTION.
 */
export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          LEGAL REVIEW REQUIRED BEFORE PRODUCTION
        </p>
        <p className="mt-2 text-xs text-slate-500">
          This page is a transparency draft for V1 launch preparation. It is <strong>not</strong> a final effective legal
          text and has <strong>not</strong> been signed off by counsel.
        </p>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Privacy Policy</h1>
        <p className="mt-1 text-lg text-slate-600 dark:text-slate-400">Datenschutzerklärung</p>

        <div className="mt-8 space-y-10 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">1. Controller identity</h2>
            <p className="mt-3">
              <strong>Controller / Operator:</strong> Zwima Technologie GmbH
              <br />
              Dormagener Str. 2e
              <br />
              41468 Neuss
              <br />
              Germany
              <br />
              Website:{" "}
              <a className="underline" href="https://zwima-group.info">
                https://zwima-group.info
              </a>
              <br />
              Email:{" "}
              <a className="underline" href="mailto:hello@zwima-group.info">
                hello@zwima-group.info
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">2. Scope of this policy</h2>
            <p className="mt-3">
              This draft describes how personal data may be processed in connection with the ZWIMA AI website, accounts,
              dashboards, and API services. Product features and processors may evolve; where details are not yet
              counsel-approved they are marked <code>POLICY_PENDING</code> or <code>LEGAL_REVIEW_REQUIRED</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">3. Roles (confirmed model)</h2>
            <h3 className="mt-3 font-medium text-slate-900 dark:text-white">3.1 API customer content</h3>
            <p className="mt-2">
              For prompts, files, business data, and model outputs that you submit to or receive through the ZWIMA API:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>You (the customer)</strong> are the <strong>Data Controller</strong>
              </li>
              <li>
                <strong>Zwima Technologie GmbH</strong> is the <strong>Data Processor</strong>
              </li>
              <li>ZWIMA processes such data only on your documented instructions (see also our DPA draft)</li>
            </ul>
            <h3 className="mt-4 font-medium text-slate-900 dark:text-white">3.2 Platform operations data</h3>
            <p className="mt-2">
              For account, billing, security, audit, anti-abuse/fraud, and statutory compliance data,{" "}
              <strong>Zwima Technologie GmbH</strong> is an <strong>independent Data Controller</strong>. Account and
              billing data are not described as controlled by the customer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">4. Account and authentication data</h2>
            <p className="mt-3">
              When you register or sign in, we process account identifiers and authentication-related data (for example
              name, email, organisation membership, and session/security tokens via our authentication provider). Legal
              basis candidates: Art. 6(1)(b) and/or (f) GDPR — <code>LEGAL_REVIEW_REQUIRED</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">
              5. API prompts, files, business data and model outputs
            </h2>
            <p className="mt-3">
              Content you send to the API (prompts, files, business data) and resulting model outputs are processed so we
              can provide the service as your processor under your instructions. You determine what personal data (if
              any) is included in those inputs. Retention for this category: <code>POLICY_PENDING</code> (counsel to
              define; not invented here).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">6. Usage, billing and security logs</h2>
            <p className="mt-3">
              We process usage metrics, billing/subscription/payment/invoice records, and security, abuse-prevention,
              fraud/risk, and audit logs as independent controller for operating, securing, and billing the platform and
              meeting legal duties. Specific retention periods: <code>POLICY_PENDING</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">7. Processing purposes</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Provide and improve the website, accounts, and API services</li>
              <li>Authenticate users and protect accounts</li>
              <li>Process API requests and return model outputs on customer instructions</li>
              <li>Billing, invoicing, and subscription administration</li>
              <li>Security, abuse prevention, fraud/risk controls, and auditing</li>
              <li>Legal compliance and tax retention where required</li>
              <li>Respond to privacy and GDPR requests at hello@zwima-group.info</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">8. Legal bases under GDPR</h2>
            <p className="mt-3">
              Depending on the processing activity, we may rely on Art. 6(1)(b) (contract), Art. 6(1)(c) (legal
              obligation), and/or Art. 6(1)(f) (legitimate interests, e.g. security). Mapping of each purpose to a final
              legal basis: <code>LEGAL_REVIEW_REQUIRED</code>. Where we act as processor, the customer&apos;s legal bases
              apply to the underlying processing of customer content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">
              9. AI providers and sub-processor disclosure
            </h2>
            <p className="mt-3">
              To operate the platform we use categories of service providers that may process personal data as our
              sub-processors (or as processors supporting ZWIMA as controller for platform data), including:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>AI model providers</li>
              <li>Cloud / database providers</li>
              <li>Authentication provider</li>
              <li>Email provider</li>
              <li>Payment provider</li>
            </ul>
            <p className="mt-3">
            The concrete vendor list is maintained on our{" "}
            <Link className="underline" href="/legal/sub-processors">
              Sub-processors
            </Link>{" "}
            page (and DPA annex). Named transfer/retention details may still be{" "}
            <code>POLICY_PENDING</code> / <code>LEGAL_REVIEW_REQUIRED</code>. We do <strong>not</strong> claim that all
            processing occurs only in the EU, and we do <strong>not</strong> claim that third-country providers are never
            used.
          </p>
        </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">10. International data transfers</h2>
            <p className="mt-3">
              Where personal data is transferred outside the EEA (or other applicable regions), we will use appropriate
              safeguards as required by law (for example Standard Contractual Clauses), as documented in the final LEGAL
              annex. Transfer inventory and mechanism details: <code>LEGAL_REVIEW_REQUIRED</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">11. Data retention</h2>
            <p className="mt-3">
              We retain personal data only as long as needed for the purposes above or as required by law. Exact deletion
              and retention schedules are <code>POLICY_PENDING</code> and will not be invented on this draft page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">12. Security measures</h2>
            <p className="mt-3">
              We apply technical and organisational measures appropriate to the risk (access controls, encryption in
              transit where applicable, logging, and least-privilege practices). A formal TOM annex is{" "}
              <code>LEGAL_REVIEW_REQUIRED</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">13. Data subject rights</h2>
            <p className="mt-3">
              Where GDPR applies, you may have rights of access, rectification, erasure, restriction, portability,
              objection, and the right not to be subject to certain automated decisions. How to exercise rights for
              platform-controller data: contact{" "}
              <a className="underline" href="mailto:hello@zwima-group.info">
                hello@zwima-group.info
              </a>
              . For API content where you are controller, contact your organisation; we assist as processor under the
              DPA.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">14. Right to lodge a complaint</h2>
            <p className="mt-3">
              You may lodge a complaint with a competent supervisory authority, in particular in the EU Member State of
              your habitual residence, place of work, or of an alleged infringement. The authority competent for our seat
              in North Rhine-Westphalia is expected to be the Landesbeauftragte für Datenschutz und
              Informationsfreiheit Nordrhein-Westfalen (LDI NRW) — confirmation <code>LEGAL_REVIEW_REQUIRED</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">
              15. Contact for privacy and GDPR requests
            </h2>
            <p className="mt-3">
              All privacy, GDPR, and data-subject requests for V1:{" "}
              <a className="underline" href="mailto:hello@zwima-group.info">
                hello@zwima-group.info
              </a>
              . A dedicated <code>privacy@</code> address is an optional future improvement and is not used on this page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">16. Cookies</h2>
            <p className="mt-3">
              On V1 we use <strong>strictly necessary cookies only</strong>. We do not use Google Analytics, Meta Pixel,
              LinkedIn Insight Tag, Hotjar, Microsoft Clarity, ad retargeting, or other non-essential marketing cookies.
              V1 does not show an Accept/Reject consent banner. If we introduce non-essential cookies later, we will
              enable a CMP and obtain consent first. Details:{" "}
              <Link className="underline" href="/cookies">
                Cookies
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">17. Changes to this policy</h2>
            <p className="mt-3">
              We may update this draft as the product and legal review progress. Material changes will be reflected on
              this page; effective-date / versioning mechanics: <code>POLICY_PENDING</code>.
            </p>
          </section>
        </div>

        <p className="mt-10 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          LEGAL REVIEW REQUIRED BEFORE PRODUCTION
        </p>

        <p className="mt-6 text-xs text-slate-500">
          Related:{" "}
          <Link className="underline" href="/imprint">
            Impressum
          </Link>
          {" · "}
          <Link className="underline" href="/cookies">
            Cookies
          </Link>
          {" · "}
          <Link className="underline" href="/legal/dpa">
            DPA
          </Link>
          {" · "}
          <Link className="underline" href="/legal/sub-processors">
            Sub-processors
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
