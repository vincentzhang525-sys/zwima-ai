import { OpsDashboardClient } from "@/components/ops-dashboard-client";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";

export default async function AdminOpsDashboardPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  return <OpsDashboardClient />;
}
