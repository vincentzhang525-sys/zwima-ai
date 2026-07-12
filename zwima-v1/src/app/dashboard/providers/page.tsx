import { ProvidersAdminClient } from "@/components/providers-admin-client";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";

export default async function ProvidersAdminPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  return <ProvidersAdminClient />;
}
