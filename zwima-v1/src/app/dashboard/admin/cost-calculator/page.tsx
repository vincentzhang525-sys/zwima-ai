import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { CostCalculatorAdminClient } from "@/components/cost-calculator-admin-client";

export default async function AdminCostCalculatorPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");
  return <CostCalculatorAdminClient />;
}
