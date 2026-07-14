import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function AdminAuditPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const logs = await prisma.aiAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      requestId: true,
      selectedProvider: true,
      selectedModel: true,
      status: true,
      customerCharge: true,
      fallbackCount: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Audit Log</h1>
        <p className="text-sm text-slate-500">Audit-ready logging with traceable AI usage. Compliance support — not legal certification.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left">Request ID</th>
              <th className="px-4 py-3 text-left">Provider</th>
              <th className="px-4 py-3 text-left">Model</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Credits</th>
              <th className="px-4 py-3 text-left">Fallback</th>
              <th className="px-4 py-3 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.requestId} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 font-mono text-xs">{l.requestId.slice(0, 16)}…</td>
                <td className="px-4 py-3">{l.selectedProvider}</td>
                <td className="px-4 py-3">{l.selectedModel}</td>
                <td className="px-4 py-3">{l.status}</td>
                <td className="px-4 py-3">{l.customerCharge}</td>
                <td className="px-4 py-3">{l.fallbackCount}</td>
                <td className="px-4 py-3">{l.createdAt.toISOString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
