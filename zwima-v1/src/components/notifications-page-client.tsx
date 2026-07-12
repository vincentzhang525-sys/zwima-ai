"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type Notification = { id: string; type: string; title: string; message: string; read: boolean; createdAt: string };

export function NotificationsPageClient() {
  const [items, setItems] = useState<Notification[]>([]);

  async function load() {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    setItems(data.notifications ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    load();
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Notification Center</CardTitle>
        <Button variant="secondary" size="sm" onClick={markAllRead}>
          Mark all read
        </Button>
      </div>
      <div className="mt-4 space-y-3">
        {items.length === 0 && <EmptyState title="No notifications" description="Low balance, payments, and API alerts appear here." />}
        {items.map((n) => (
          <div
            key={n.id}
            className={`rounded-lg border p-4 ${n.read ? "border-slate-200 dark:border-slate-700" : "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-slate-500">{n.message}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">{n.type.replace(/_/g, " ")}</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
