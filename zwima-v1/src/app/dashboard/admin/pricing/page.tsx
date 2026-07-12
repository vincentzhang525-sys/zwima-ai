import { AdminPricingClient } from "@/components/admin-pricing-client";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";

export default async function AdminPricingPage() {
  if (!(await isAdmin())) redirect("/dashboard");
  return <AdminPricingClient />;
}
