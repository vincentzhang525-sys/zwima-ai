"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";

const ROUTING_MODES = ["BALANCED", "LOWEST_COST", "LOWEST_LATENCY", "HIGHEST_QUALITY", "EU_COMPLIANCE"];

type Settings = {
  defaultRoutingMode: string;
  defaultRegion: string;
  euDataResidency: boolean;
  aiTransparency: boolean;
  monthlyBudget: number | null;
  budgetAlerts: boolean;
  usageAlerts: boolean;
  emailNotifications: boolean;
  billingProfile: { companyName: string; vatId: string; billingAddress: string; country: string };
  organizationProfile: { name: string };
  apiSecurityDefaults: { routingMode: string; ipAllowlist: string };
};

export function WorkspaceSettingsClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function load(options?: { silent?: boolean }) {
    if (!options?.silent) setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/workspace/settings");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error?.message || "Failed to load settings");
      else { setSettings(data.settings); setError(""); }
    } catch {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaved(false);
    const res = await fetch("/api/workspace/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSaved(true);
      await load({ silent: true });
    } else {
      const data = await res.json();
      setError(data.error?.message || "Save failed");
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading settings…</p>;
  if (error && !settings) return <ErrorState message={error} onRetry={load} />;
  if (!settings) return null;

  return (
    <form onSubmit={save} className="space-y-6">
      {saved && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">Settings saved.</div>}

      <Card>
        <CardTitle>Organization Profile</CardTitle>
        <div className="mt-4"><Label>Name</Label><Input value={settings.organizationProfile.name} onChange={(e) => setSettings({ ...settings, organizationProfile: { name: e.target.value } })} /></div>
      </Card>

      <Card>
        <CardTitle>Billing Profile</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><Label>Company Name</Label><Input value={settings.billingProfile.companyName} onChange={(e) => setSettings({ ...settings, billingProfile: { ...settings.billingProfile, companyName: e.target.value } })} /></div>
          <div><Label>VAT ID</Label><Input value={settings.billingProfile.vatId} onChange={(e) => setSettings({ ...settings, billingProfile: { ...settings.billingProfile, vatId: e.target.value } })} /></div>
          <div className="sm:col-span-2"><Label>Billing Address</Label><Input value={settings.billingProfile.billingAddress} onChange={(e) => setSettings({ ...settings, billingProfile: { ...settings.billingProfile, billingAddress: e.target.value } })} /></div>
          <div><Label>Country</Label><Input value={settings.billingProfile.country} onChange={(e) => setSettings({ ...settings, billingProfile: { ...settings.billingProfile, country: e.target.value } })} /></div>
        </div>
      </Card>

      <Card>
        <CardTitle>AI & Routing Defaults</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Default Routing Mode</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={settings.defaultRoutingMode} onChange={(e) => setSettings({ ...settings, defaultRoutingMode: e.target.value })}>
              {ROUTING_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><Label>Default Region</Label><Input value={settings.defaultRegion} onChange={(e) => setSettings({ ...settings, defaultRegion: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.euDataResidency} onChange={(e) => setSettings({ ...settings, euDataResidency: e.target.checked })} /> EU Data Residency</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.aiTransparency} onChange={(e) => setSettings({ ...settings, aiTransparency: e.target.checked })} /> AI Transparency</label>
        </div>
      </Card>

      <Card>
        <CardTitle>Budget & Alerts</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><Label>Monthly Budget (credits)</Label><Input type="number" value={settings.monthlyBudget ?? ""} onChange={(e) => setSettings({ ...settings, monthlyBudget: e.target.value ? Number(e.target.value) : null })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.budgetAlerts} onChange={(e) => setSettings({ ...settings, budgetAlerts: e.target.checked })} /> Budget Alerts</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.usageAlerts} onChange={(e) => setSettings({ ...settings, usageAlerts: e.target.checked })} /> Usage Alerts</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.emailNotifications} onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })} /> Email Notifications</label>
        </div>
      </Card>

      <Button type="submit">Save Settings</Button>
    </form>
  );
}
