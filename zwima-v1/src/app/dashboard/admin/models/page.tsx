import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { ModelsLifecycleAdminClient } from "@/components/models-lifecycle-admin-client";

export default async function AdminModelsPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");
  return <ModelsLifecycleAdminClient />;
}
