import Link from "next/link";

export default function AgentsOverviewPage() {
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Agents</h1>
      <p className="text-sm text-slate-600">
        Mock-provider agent platform (M8). No live model calls.
      </p>
      <p className="text-sm">
        <Link className="text-blue-900 underline" href="/dashboard/agents">
          Open agent list
        </Link>
      </p>
    </div>
  );
}
