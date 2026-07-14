import { RoutingAdminClient } from "@/components/routing-admin-client";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";

export default async function AdminRoutingPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  return <RoutingAdminClient />;
}
