import Link from "next/link";

/**
 * Mild public draft notice — no development-stage / pre-production warning copy.
 * Content still needs final legal review; does not assert legal conclusions.
 */
export function LegalDraftNotice() {
  return (
    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
      Draft informational page. Content remains subject to final legal review and is not final counsel-approved text.
    </p>
  );
}

export const LEGAL_FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/imprint", label: "Impressum" },
  { href: "/cookies", label: "Cookies" },
  { href: "/legal/dpa", label: "DPA" },
  { href: "/legal/sub-processors", label: "Sub-processors" },
] as const;

export function LegalFooterLinks({ className = "mt-3 space-y-2 text-sm text-slate-500" }: { className?: string }) {
  return (
    <ul className={className}>
      {LEGAL_FOOTER_LINKS.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="underline-offset-2 hover:underline">
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
