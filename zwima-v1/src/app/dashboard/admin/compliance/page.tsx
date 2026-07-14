import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { ComplianceAdminClient } from "@/components/compliance-admin-client";

export default async function AdminCompliancePage() {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");
  return <ComplianceAdminClient />;
}
