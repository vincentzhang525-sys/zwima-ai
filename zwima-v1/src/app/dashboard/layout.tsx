import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DashboardShell } from "@/components/dashboard-shell";
import { isAdmin } from "@/lib/admin";
import { getCurrentDbUser } from "@/lib/auth";
import { hasCurrentLegalConsent } from "@/lib/compliance/legal-consent";

function isAcceptTermsPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/dashboard/accept-terms" ||
    pathname.startsWith("/dashboard/accept-terms/")
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const pathname = h.get("x-zwima-pathname");
  const onAcceptTerms = isAcceptTermsPath(pathname);

  const user = await getCurrentDbUser();
  if (user && pathname && !onAcceptTerms) {
    const accepted = await hasCurrentLegalConsent(user.id);
    if (!accepted) {
      redirect("/dashboard/accept-terms");
    }
  }

  if (user && onAcceptTerms) {
    const accepted = await hasCurrentLegalConsent(user.id);
    if (accepted) {
      redirect("/dashboard");
    }
  }

  const admin = await isAdmin();
  return <DashboardShell isAdmin={admin}>{children}</DashboardShell>;
}
