import { getCurrentDbUser } from "@/lib/auth";
import { BillingEngine } from "@/lib/billing";
import { Card } from "@/components/ui/card";
import { redirect } from "next/navigation";

export default async function InvoicesPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  const invoices = await BillingEngine.invoice.list(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoices</h1>
        <p className="text-sm text-slate-500">Download PDF invoices for recharges</p>
      </div>

      <Card>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                <th className="pb-2 pr-4">Number</th>
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Total</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">PDF</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-slate-500">No invoices yet</td></tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-4 font-mono text-xs">{inv.invoiceNumber}</td>
                  <td className="py-2 pr-4">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">€{Number(inv.totalEur).toFixed(2)}</td>
                  <td className="py-2 pr-4">{inv.paid ? "Paid" : "Unpaid"}</td>
                  <td className="py-2">
                    <a
                      href={`/api/v1/invoices/${inv.id}/pdf`}
                      className="text-blue-900 dark:text-blue-400"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
