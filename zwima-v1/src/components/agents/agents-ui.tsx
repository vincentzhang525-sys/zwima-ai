"use client";

import Link from "next/link";

const LINKS = [
  { href: "/dashboard/agents", label: "Agents" },
  { href: "/dashboard/agents/templates", label: "Templates" },
  { href: "/dashboard/tools", label: "Tools" },
  { href: "/dashboard/prompts", label: "Prompts" },
  { href: "/dashboard/agent-memory", label: "Memory" },
  { href: "/dashboard/agent-reviews", label: "Reviews" },
];

const ADMIN_LINKS = [
  { href: "/dashboard/admin/agents", label: "Admin Agents" },
  { href: "/dashboard/admin/agent-runs", label: "Admin Runs" },
  { href: "/dashboard/admin/tools", label: "Admin Tools" },
  { href: "/dashboard/admin/prompts", label: "Admin Prompts" },
  { href: "/dashboard/admin/agent-policies", label: "Policies" },
  { href: "/dashboard/admin/agent-metrics", label: "Metrics" },
];

export function AgentsSubnav({ admin = false }: { admin?: boolean }) {
  const links = admin ? ADMIN_LINKS : LINKS;
  return (
    <nav className="flex flex-wrap gap-3 text-sm text-slate-600">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-slate-900 underline-offset-2 hover:underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function AgentsDisclaimer() {
  return (
    <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      M8 Agent Platform uses a Mock model/tool provider only. No live provider calls, no real emails, no external writes.
    </p>
  );
}

export function AgentsStateBox({
  state,
  message,
}: {
  state: "loading" | "error" | "empty";
  message: string;
}) {
  const color =
    state === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-slate-50 text-slate-700";
  return <div className={`rounded border px-3 py-2 text-sm ${color}`}>{message}</div>;
}
