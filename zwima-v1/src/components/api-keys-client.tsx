"use client";

import { Copy, Trash2, Power } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  enabled: boolean;
  createdAt: string;
  lastUsed: string | null;
};

export function ApiKeysClient({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createKey(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (res.ok) {
      setKeys((prev) => [data.key, ...prev]);
      setNewKey(data.fullKey);
      setName("");
    }
    setLoading(false);
  }

  async function toggleKey(id: string, enabled: boolean) {
    const res = await fetch(`/api/api-keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, enabled } : k)));
    }
  }

  async function deleteKey(id: string) {
    if (!confirm("Delete this API key?")) return;
    const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    if (res.ok) setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Create API Key</CardTitle>
        <form onSubmit={createKey} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="keyName">Name</Label>
            <Input id="keyName" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Production key" />
          </div>
          <Button type="submit" disabled={loading}>
            Create
          </Button>
        </form>
        {newKey && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Copy your key now — it won&apos;t be shown again.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-white px-2 py-1 text-sm dark:bg-slate-900">{newKey}</code>
              <Button type="button" variant="secondary" size="sm" onClick={() => copy(newKey)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Your Keys</CardTitle>
        <div className="mt-4 space-y-3">
          {keys.length === 0 && <p className="text-sm text-slate-500">No API keys yet</p>}
          {keys.map((key) => (
            <div key={key.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div>
                <p className="font-medium">{key.name}</p>
                <code className="text-sm text-slate-500">{key.prefix}</code>
                <p className="text-xs text-slate-400">{key.enabled ? "Active" : "Disabled"}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => copy(key.prefix)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => toggleKey(key.id, !key.enabled)}>
                  <Power className="h-4 w-4" />
                </Button>
                <Button type="button" variant="danger" size="sm" onClick={() => deleteKey(key.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
