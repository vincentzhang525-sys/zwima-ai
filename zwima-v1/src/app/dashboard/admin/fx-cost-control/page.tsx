import { requireAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { FxCostControlAdminClient } from "@/components/fx-cost-control-admin-client";

export default async function FxCostControlAdminPage() {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/dashboard");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">M4 FX Cost &amp; Margin Control</h1>
        <p className="text-sm text-slate-500">
          Provider currency, FX snapshots, buffered EUR cost, gross margin, and package repricing alerts.
          Historical usage FX is immutable. Customer prices are never auto-changed.
        </p>
      </div>
      <FxCostControlAdminClient />
    </div>
  );
}
