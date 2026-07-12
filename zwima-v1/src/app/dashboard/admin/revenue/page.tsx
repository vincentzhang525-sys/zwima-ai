import { AdminRevenueClient } from "@/components/admin-revenue-client";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";

export default async function AdminRevenuePage() {
  if (!(await isAdmin())) redirect("/dashboard");
  return <AdminRevenueClient />;
}
