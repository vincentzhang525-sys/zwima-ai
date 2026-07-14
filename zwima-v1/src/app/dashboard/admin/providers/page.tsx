import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { ProvidersManagementAdminClient } from "@/components/providers-management-admin-client";

export default async function AdminProvidersPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");
  return <ProvidersManagementAdminClient />;
}
