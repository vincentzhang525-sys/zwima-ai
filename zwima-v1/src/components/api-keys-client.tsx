"use client";

import { Copy, RefreshCw, Trash2, Power, Pencil } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import type { KeyPermission } from "@prisma/client";

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  enabled: boolean;
  permission: KeyPermission;
  ipWhitelist: string | null;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: string | null;
  createdAt: string;
  lastUsed: string | null;
};

const PERMISSIONS: KeyPermission[] = ["FULL", "READ", "CHAT"];

export function ApiKeysClient({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [permission, setPermission] = useState<KeyPermission>("FULL");
  const [ipWhitelist, setIpWhitelist] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function createKey(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, permission, ipWhitelist: ipWhitelist || null, usageLimit: usageLimit || null, expiresAt: expiresAt || null }),
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
    if (res.ok) setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, enabled } : k)));
  }

  async function renameKey(id: string) {
    const res = await fetch(`/api/api-keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    if (res.ok) {
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, name: editName } : k)));
      setEditingId(null);
    }
  }

  async function regenerateKey(id: string) {
    if (!confirm("Regenerate this key? The old key will stop working.")) return;
    const res = await fetch(`/api/api-keys/${id}`, { method: "PUT" });
    const data = await res.json();
    if (res.ok) {
      setNewKey(data.fullKey);
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, ...data.key } : k)));
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
        <form onSubmit={createKey} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="keyName">Name</Label>
            <Input id="keyName" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Production key" />
          </div>
          <div>
            <Label htmlFor="permission">Permission</Label>
            <select
              id="permission"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={permission}
              onChange={(e) => setPermission(e.target.value as KeyPermission)}
            >
              {PERMISSIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="ipWhitelist">IP Whitelist</Label>
            <Input id="ipWhitelist" value={ipWhitelist} onChange={(e) => setIpWhitelist(e.target.value)} placeholder="1.2.3.4, 5.6.7.8" />
          </div>
          <div>
            <Label htmlFor="usageLimit">Usage Limit</Label>
            <Input id="usageLimit" type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="10000" />
          </div>
          <div>
            <Label htmlFor="expiresAt">Expiration</Label>
            <Input id="expiresAt" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={loading}>
              Create
            </Button>
          </div>
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
            <div key={key.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {editingId === key.id ? (
                    <div className="flex gap-2">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-xs" />
                      <Button size="sm" onClick={() => renameKey(key.id)}>
                        Save
                      </Button>
                    </div>
                  ) : (
                    <p className="font-medium">{key.name}</p>
                  )}
                  <code className="text-sm text-slate-500">{key.prefix}</code>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>{key.enabled ? "Active" : "Disabled"}</span>
                    <span>{key.permission}</span>
                    {key.usageLimit != null && (
                      <span>
                        {key.usageCount}/{key.usageLimit} uses
                      </span>
                    )}
                    {key.expiresAt && <span>Expires {new Date(key.expiresAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => copy(key.prefix)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditingId(key.id);
                      setEditName(key.name);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => regenerateKey(key.id)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => toggleKey(key.id, !key.enabled)}>
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => deleteKey(key.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
