import { DashboardShell } from "@/components/dashboard-shell";
import { isAdmin } from "@/lib/admin";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  return <DashboardShell isAdmin={admin}>{children}</DashboardShell>;
}
