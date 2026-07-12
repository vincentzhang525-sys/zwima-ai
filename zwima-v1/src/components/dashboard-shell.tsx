"use client";

import {
  BarChart3,
  CreditCard,
  FlaskConical,
  Gauge,
  History,
  Key,
  LayoutDashboard,
  Server,
  Settings,
  Shield,
  Tags,
  Users,
  Wallet,
  Bell,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/playground", label: "Playground", icon: FlaskConical },
  { href: "/dashboard/api-keys", label: "API Keys", icon: Key },
  { href: "/dashboard/usage/history", label: "Usage Explorer", icon: History },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/invoices", label: "Invoices", icon: CreditCard },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/audit", label: "Audit Log", icon: Shield },
  { href: "/dashboard/providers", label: "Providers", icon: Server },
  { href: "/dashboard/admin/console", label: "Admin Console", icon: Building2 },
  { href: "/dashboard/admin/revenue", label: "Revenue", icon: Gauge },
  { href: "/dashboard/admin/pricing", label: "Pricing", icon: Tags },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="flex">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-slate-200 bg-white p-4 transition dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div className="mb-8 flex items-center justify-between">
            <Logo />
            <button type="button" className="lg:hidden" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
                    ? "bg-blue-900 text-white dark:bg-blue-700"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 lg:px-6">
            <button type="button" className="lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
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
