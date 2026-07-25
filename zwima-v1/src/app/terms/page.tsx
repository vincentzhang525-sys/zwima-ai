import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Terms of Service — ZWIMA AI",
  description:
    "Terms of Service / Nutzungsbedingungen draft for Zwima Technologie GmbH. Legal review required before Production.",
};

/**
 * Additive public Terms draft (P1.9).
 * Not final effective legal text — LEGAL REVIEW REQUIRED BEFORE PRODUCTION.
 */
export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          LEGAL REVIEW REQUIRED BEFORE PRODUCTION
        </p>
        <p className="mt-2 text-xs text-slate-500">
          This page is a V1 launch-preparation draft. It is <strong>not</strong> final counsel-approved text and is{" "}
          <strong>not</strong> claimed to be fully in force as a signed legal instrument.
        </p>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Terms of Service
        </h1>
        <p className="mt-1 text-lg text-slate-600 dark:text-slate-400">Nutzungsbedingungen</p>

        <div className="mt-8 space-y-10 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">1. Provider</h2>
            <p className="mt-3">
              <strong>Provider:</strong> Zwima Technologie GmbH
              <br />
              Dormagener Str. 2e, 41468 Neuss, Germany
              <br />
              Email:{" "}
              <a className="underline" href="mailto:hello@zwima-group.info">
                hello@zwima-group.info
              </a>
              <br />
              Website:{" "}
              <a className="underline" href="https://zwima-group.info">
                https://zwima-group.info
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">2. Scope and applicability</h2>
            <p className="mt-3">
              These Terms govern access to and use of the ZWIMA AI website, dashboards, APIs, and related digital
              services. V1 is offered primarily to <strong>businesses, freelancers, legal entities, and other commercial
              customers (B2B)</strong>. We do not actively market V1 to ordinary consumers. If consumer law nevertheless
              applies in a given case, mandatory German and EU consumer protections remain unaffected and are not
              excluded by these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">3. Eligibility and account registration</h2>
            <p className="mt-3">
              You must provide accurate registration information and keep it up to date. You may only use the service if
              you have legal capacity and authority to bind the customer organisation you represent. Age / eligibility
              details: <code>POLICY_PENDING</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">4. Business customer status</h2>
            <p className="mt-3">
              By registering for a paid or API-enabled account, you represent that you act as or for a business /
              professional customer, unless mandatory law treats you as a consumer. Jurisdiction and certain commercial
              clauses below apply to B2B customers only where legally permissible.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">5. API credentials and account security</h2>
            <p className="mt-3">
              You are responsible for safeguarding login credentials and API keys, for all activity under your account,
              and for promptly notifying us of suspected unauthorised access at hello@zwima-group.info.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">6. Permitted use</h2>
            <p className="mt-3">
              You may use the service to access AI model capabilities via our APIs and dashboards in accordance with these
              Terms, our documentation, applicable law, and upstream provider policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">7. Prohibited use</h2>
            <p className="mt-3">Without limitation, you must not:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Engage in illegal activity</li>
              <li>Commit fraud, infringement, or distribute malware</li>
              <li>Bypass security, quotas, rate limits, or access controls</li>
              <li>Process personal data without a lawful basis and required authorisations</li>
              <li>Violate upstream model provider policies</li>
              <li>Use the platform for restricted or sanctioned purposes</li>
              <li>Resell or share API keys unless a written contract expressly permits it</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">8. AI model and provider availability</h2>
            <p className="mt-3">
              Model outputs may be inaccurate, incomplete, or unsuitable for a particular purpose. You must apply human
              review for high-risk, legal, medical, financial, or safety-critical use cases. We do not guarantee that any
              model remains continuously available. Upstream suppliers may change models, pricing, rate limits, regional
              support, or shutdown dates. ZWIMA may route or migrate traffic based on cost, availability, compliance, and
              your configuration.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">
              9. Model changes, deprecations and shutdowns
            </h2>
            <p className="mt-3">
              We may add, deprecate, or remove models and routes. Where reasonably practicable we will provide notice
              through the product or documentation. Notice periods: <code>POLICY_PENDING</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">10. Usage measurement and billing</h2>
            <p className="mt-3">
              Usage is measured according to our metering (for example tokens, requests, or other billable units shown in
              the product). Disputed metering procedures: <code>POLICY_PENDING</code> /{" "}
              <code>LEGAL_REVIEW_REQUIRED</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">
              11. Credits, prepaid balance and expiry rules
            </h2>
            <p className="mt-3">
              Platform Credits / prepaid balances may be used only to purchase API usage and related digital services on
              the ZWIMA platform. Credits are <strong>not</strong> crypto-assets, securities, electronic money, or bank
              deposits. Credits are generally non-tradable, non-transferable, and not redeemable for cash, except where
              mandatory law requires otherwise. We do not promise fixed yield, appreciation, or investment returns.
              Prepaid balances are kept strictly separate from any tradable token or crypto asset. Specific refund,
              expiry, and balance-handling rules: <code>POLICY_PENDING</code> (awaiting final commercial policy).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">12. Taxes and invoicing</h2>
            <p className="mt-3">
              Prices and invoices may be subject to applicable taxes (including VAT). Tax treatment and invoice fields:{" "}
              <code>POLICY_PENDING</code> / tax-advisor confirmation. VAT ID display on Impressum remains{" "}
              <code>VAT_ID_PENDING</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">
              13. Fair use, rate limits and abuse prevention
            </h2>
            <p className="mt-3">
              We may apply rate limits, fair-use controls, and abuse-prevention measures to protect the platform and other
              customers. Circumvention is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">14. Customer content and instructions</h2>
            <p className="mt-3">
              You are responsible for content you submit and for ensuring you have the rights and lawful bases to process
              it. For API prompts, files, business data, and model outputs, you are Controller and ZWIMA is Processor on
              documented instructions — see our{" "}
              <Link className="underline" href="/legal/dpa">
                DPA
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">15. Data protection and DPA reference</h2>
            <p className="mt-3">
              Personal data is processed as described in our{" "}
              <Link className="underline" href="/privacy">
                Privacy Policy
              </Link>{" "}
              and, where applicable, the{" "}
              <Link className="underline" href="/legal/dpa">
                Data Processing Agreement
              </Link>
              . Cookies:{" "}
              <Link className="underline" href="/cookies">
                Cookies
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">16. Intellectual property</h2>
            <p className="mt-3">
              ZWIMA and its licensors retain rights in the platform, branding, and documentation. Subject to the service
              and upstream licences, you retain rights in your inputs; allocation of rights in model outputs:{" "}
              <code>LEGAL_REVIEW_REQUIRED</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">17. Third-party providers</h2>
            <p className="mt-3">
              The service depends on third-party AI, cloud, authentication, email, and payment providers. Their terms and
              availability may affect the service. Named sub-processor lists are maintained dynamically (DPA annex /
              future Sub-processors page) and are not hardcoded here.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">18. Service availability and maintenance</h2>
            <p className="mt-3">
              We aim for reasonable availability but do not guarantee uninterrupted service. Maintenance windows and SLA
              (if any): <code>POLICY_PENDING</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">19. Suspension and termination</h2>
            <p className="mt-3">
              We may suspend or terminate access for breach, abuse, legal risk, non-payment, or security incidents. Your
              termination rights and notice periods: <code>LEGAL_REVIEW_REQUIRED</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">20. Warranty limitations</h2>
            <p className="mt-3">
              The service is provided with commercially reasonable care. Except where mandatory law requires otherwise,
              we do not warrant uninterrupted, error-free, or fit-for-particular-purpose operation of models or routes.
              Absolute disclaimers are not used. Final warranty wording: <code>LEGAL_REVIEW_REQUIRED</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">21. Liability limitations</h2>
            <p className="mt-3">
              Nothing in these Terms excludes or limits liability for intent (Vorsatz), gross negligence
              (grobe Fahrlässigkeit), injury to life, body, or health, or any other liability that cannot be excluded
              under German law (including mandatory product liability where applicable). Other liability caps and
              exclusions: <code>LEGAL_REVIEW_REQUIRED</code> — not final counsel text and not an absolute waiver.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">22. Indemnification</h2>
            <p className="mt-3">
              B2B customers shall indemnify ZWIMA against third-party claims arising from unlawful customer content or
              prohibited use, to the extent permitted by law. Scope and procedure:{" "}
              <code>LEGAL_REVIEW_REQUIRED</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">
              23. Changes to the service and terms
            </h2>
            <p className="mt-3">
              We may update the service and these Terms. Material changes will be indicated on this page or by notice in
              the product. Change-notice mechanics: <code>POLICY_PENDING</code>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">24. Governing law and jurisdiction</h2>
            <p className="mt-3">
              These Terms are governed by the laws of the <strong>Federal Republic of Germany</strong>, excluding
              conflict-of-law rules that would refer to another jurisdiction.
            </p>
            <p className="mt-3">
              <strong>B2B:</strong> If you are a merchant (Kaufmann), a legal entity under public law, or a special fund
              under public law, the exclusive place of jurisdiction is <strong>Neuss, Germany</strong>, where legally
              permissible.
            </p>
            <p className="mt-3">
              <strong>Consumers:</strong> No exclusive Neuss-only forum is imposed. Mandatory consumer protections and
              statutory venues remain unaffected. These Terms do not state that all disputes may only be heard in Neuss.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">25. Contact information</h2>
            <p className="mt-3">
              Zwima Technologie GmbH — hello@zwima-group.info —{" "}
              <Link className="underline" href="/imprint">
                Impressum
              </Link>
              .
            </p>
          </section>
        </div>

        <p className="mt-10 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          LEGAL REVIEW REQUIRED BEFORE PRODUCTION
        </p>

        <p className="mt-6 text-xs text-slate-500">
          Related:{" "}
          <Link className="underline" href="/privacy">
            Privacy
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
