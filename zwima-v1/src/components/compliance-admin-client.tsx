"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

const STATUSES = ["PENDING_REVIEW", "COMPLIANT", "NON_COMPLIANT", "EXEMPT"] as const;
const LAWFUL_BASES = ["consent", "contract", "legitimate_interest", "legal_obligation"] as const;

type GdprFlags = {
  euDataResidency?: boolean;
  requiresDpa?: boolean;
  lawfulBasis?: string | null;
  retentionDays?: number | null;
  dataMinimization?: boolean;
  rightToErasure?: boolean;
  crossBorderTransfer?: boolean;
};

type ProfileRow = {
  id: string;
  providerModelId: string;
  transparencyRequired: boolean;
  aiGeneratedLabelRequired: boolean;
  deepfakeDisclosureRequired: boolean;
  complianceStatus: string;
  gdpr: GdprFlags;
  providerModel: { modelCode: string; provider: { slug: string } };
};

type AuditRow = {
  id: string;
  action: string;
  createdAt: string;
  detail: unknown;
  user?: { email: string } | null;
};

export function ComplianceAdminClient() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/compliance");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed");
      setProfiles([]);
    } else {
      setProfiles(data.profiles || []);
      setAuditLogs(data.auditLogs || []);
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(providerModelId: string, patch: Record<string, unknown>) {
    await fetch("/api/admin/compliance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerModelId, ...patch }),
    });
    load();
  }

  function patchGdpr(providerModelId: string, current: GdprFlags, key: keyof GdprFlags, value: unknown) {
    patch(providerModelId, { gdpr: { ...current, [key]: value } });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Compliance Center</h1>
        <p className="text-sm text-slate-500">
          EU AI Act Art. 50 transparency, GDPR flags, audit trail & compliance status — per model, no code changes.
        </p>
      </div>
      {error && <ErrorState message={error} onRetry={load} />}

      <Card>
        <CardTitle>Model compliance profiles</CardTitle>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading…</p>
        ) : profiles.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No profiles yet. Create a model in Model Lifecycle — compliance profile is auto-created.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-3">Model</th>
                  <th className="pb-2 pr-3">Transparency</th>
                  <th className="pb-2 pr-3">AI Content</th>
                  <th className="pb-2 pr-3">Deepfake</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">EU Residency</th>
                  <th className="pb-2 pr-3">DPA</th>
                  <th className="pb-2 pr-3">Minimization</th>
                  <th className="pb-2 pr-3">Erasure</th>
                  <th className="pb-2">Lawful basis</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3">
                      {p.providerModel.provider.slug}/{p.providerModel.modelCode}
                    </td>
                    <td className="py-2 pr-3">
                      <input type="checkbox" checked={p.transparencyRequired} onChange={(e) => patch(p.providerModelId, { transparencyRequired: e.target.checked })} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="checkbox" checked={p.aiGeneratedLabelRequired} onChange={(e) => patch(p.providerModelId, { aiGeneratedLabelRequired: e.target.checked })} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="checkbox" checked={p.deepfakeDisclosureRequired} onChange={(e) => patch(p.providerModelId, { deepfakeDisclosureRequired: e.target.checked })} />
                    </td>
                    <td className="py-2 pr-3">
                      <select className="rounded border px-2 py-1 text-xs dark:border-slate-700" value={p.complianceStatus} onChange={(e) => patch(p.providerModelId, { complianceStatus: e.target.value })}>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input type="checkbox" checked={!!p.gdpr?.euDataResidency} onChange={(e) => patchGdpr(p.providerModelId, p.gdpr || {}, "euDataResidency", e.target.checked)} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="checkbox" checked={!!p.gdpr?.requiresDpa} onChange={(e) => patchGdpr(p.providerModelId, p.gdpr || {}, "requiresDpa", e.target.checked)} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="checkbox" checked={!!p.gdpr?.dataMinimization} onChange={(e) => patchGdpr(p.providerModelId, p.gdpr || {}, "dataMinimization", e.target.checked)} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="checkbox" checked={!!p.gdpr?.rightToErasure} onChange={(e) => patchGdpr(p.providerModelId, p.gdpr || {}, "rightToErasure", e.target.checked)} />
                    </td>
                    <td className="py-2">
                      <select className="rounded border px-2 py-1 text-xs dark:border-slate-700" value={p.gdpr?.lawfulBasis ?? ""} onChange={(e) => patchGdpr(p.providerModelId, p.gdpr || {}, "lawfulBasis", e.target.value || null)}>
                        <option value="">—</option>
                        {LAWFUL_BASES.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4">
          <Button variant="secondary" onClick={load}>Refresh</Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Compliance audit log</CardTitle>
        {auditLogs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No compliance audit entries yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">Action</th>
                  <th className="pb-2 pr-3">Actor</th>
                  <th className="pb-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3 whitespace-nowrap">{log.createdAt.slice(0, 19)}</td>
                    <td className="py-2 pr-3">{log.action}</td>
                    <td className="py-2 pr-3">{log.user?.email ?? "—"}</td>
                    <td className="py-2 max-w-md truncate text-xs text-slate-500">
                      {typeof log.detail === "string" ? log.detail : JSON.stringify(log.detail)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
