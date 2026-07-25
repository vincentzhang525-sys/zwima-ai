import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Impressum — ZWIMA AI",
  description: "Impressum / legal notice for Zwima Technologie GmbH.",
};

/**
 * Additive public Impressum (P1.7).
 * Phone and VAT omitted until confirmed — LEGAL REVIEW REQUIRED BEFORE PRODUCTION.
 */
export default function ImprintPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          LEGAL REVIEW REQUIRED BEFORE PRODUCTION
        </p>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Impressum</h1>
        <p className="mt-2 text-sm text-slate-500">Angaben gemäß § 5 DDG</p>

        <section className="mt-10 space-y-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <div>
            <h2 className="font-medium text-slate-900 dark:text-white">Angaben gemäß § 5 DDG</h2>
            <p className="mt-3">
              Zwima Technologie GmbH
              <br />
              Gesellschaft mit beschränkter Haftung (GmbH)
            </p>
          </div>

          <div>
            <h2 className="font-medium text-slate-900 dark:text-white">Anschrift / Registered address</h2>
            <p className="mt-3">
              Dormagener Str. 2e
              <br />
              41468 Neuss
              <br />
              Germany
            </p>
          </div>

          <div>
            <h2 className="font-medium text-slate-900 dark:text-white">Vertreten durch / Managing Director</h2>
            <p className="mt-3">Jiao Zhang (Geschäftsführer)</p>
          </div>

          <div>
            <h2 className="font-medium text-slate-900 dark:text-white">Registereintrag / Commercial register</h2>
            <p className="mt-3">
              Registergericht: Amtsgericht Neuss
              <br />
              Handelsregister: HRB 22923
            </p>
          </div>

          <div>
            <h2 className="font-medium text-slate-900 dark:text-white">Kontakt / Contact</h2>
            <p className="mt-3">
              E-Mail:{" "}
              <a className="underline" href="mailto:hello@zwima-group.info">
                hello@zwima-group.info
              </a>
              <br />
              Website:{" "}
              <a className="underline" href="https://zwima-group.info">
                https://zwima-group.info
              </a>
            </p>
          </div>
        </section>

        <p className="mt-10 text-xs text-slate-500">
          Related:{" "}
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
