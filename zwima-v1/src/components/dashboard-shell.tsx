"use client";

import {
  BarChart3,
  CreditCard,
  FlaskConical,
  FolderKanban,
  Gauge,
  Key,
  LayoutDashboard,
  ScrollText,
  Settings,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn, formatCost } from "@/lib/utils";
import { fetchWorkspaceOverview } from "@/lib/workspace/overview-fetch";

const CUSTOMER_NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/api-keys", label: "API Keys", icon: Key },
  { href: "/dashboard/playground", label: "Playground", icon: FlaskConical },
  { href: "/dashboard/usage", label: "Usage", icon: BarChart3 },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/logs", label: "Logs", icon: ScrollText },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const ADMIN_NAV = [
  { href: "/dashboard/admin", label: "Operations", icon: Gauge },
  { href: "/dashboard/admin/routing", label: "Routing Admin", icon: Gauge },
  { href: "/dashboard/admin/audit", label: "AI Audit", icon: Shield },
];

type HeaderStats = {
  organization: { name: string };
  creditBalance: number;
  monthCostEur: number;
};

export function DashboardShell({
  children,
  isAdmin = false,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [header, setHeader] = useState<HeaderStats | null>(null);

  useEffect(() => {
    fetchWorkspaceOverview().then((d) => {
      if (d?.organization) {
        setHeader({
          organization: d.organization as { name: string },
          creditBalance: Number(d.creditBalance ?? 0),
          monthCostEur: Number(d.monthCostEur ?? 0),
        });
      }
    });
  }, []);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="flex">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-slate-200 bg-white p-4 transition dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div className="mb-6 flex items-center justify-between">
            <Logo />
            <button type="button" className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="space-y-1">
            {CUSTOMER_NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive(href)
                    ? "bg-blue-900 text-white dark:bg-blue-700"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
            {isAdmin && (
              <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Admin</p>
                {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActive(href)
                        ? "bg-slate-800 text-white"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:px-6">
            <button type="button" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex flex-1 flex-wrap items-center gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Organization</p>
                <p className="font-medium">{header?.organization.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Credits</p>
                <p className="font-medium">{header ? formatCost(header.creditBalance) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">This month</p>
                <p className="font-medium">{header ? `€${header.monthCostEur.toFixed(4)}` : "—"}</p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <NotificationBell />
              <ThemeToggle />
              <UserButton />
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
