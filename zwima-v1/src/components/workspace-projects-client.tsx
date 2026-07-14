"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

type Project = {
  id: string;
  name: string;
  description: string;
  status: "ACTIVE" | "ARCHIVED";
  monthlyBudget: number | null;
  apiKeyCount: number;
  usageRequests: number;
  usageCostEur: number;
};

export function WorkspaceProjectsClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/workspace/projects");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error?.message || "Failed to load projects");
      else setProjects(data.projects ?? []);
    } catch {
      setError("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/workspace/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    if (res.ok) {
      setName("");
      setDescription("");
      load();
    }
  }

  async function archiveProject(id: string) {
    if (!confirm("Archive this project?")) return;
    await fetch(`/api/workspace/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading projects…</p>;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Create Project</CardTitle>
        <form onSubmit={createProject} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button type="submit" className="sm:col-span-2 w-fit">Create Project</Button>
        </form>
      </Card>

      {projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Create your first project to organize API keys and usage." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>{p.name}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">{p.description || "No description"}</p>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs ${p.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"}`}>
                  {p.status}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-slate-500">API Keys</dt><dd className="font-medium">{p.apiKeyCount}</dd></div>
                <div><dt className="text-slate-500">Requests</dt><dd className="font-medium">{p.usageRequests}</dd></div>
                <div><dt className="text-slate-500">Cost (EUR)</dt><dd className="font-medium">€{p.usageCostEur.toFixed(4)}</dd></div>
                <div><dt className="text-slate-500">Budget</dt><dd className="font-medium">{p.monthlyBudget ?? "—"}</dd></div>
              </dl>
              {p.status === "ACTIVE" && p.name !== "General" && (
                <Button variant="secondary" className="mt-4" onClick={() => archiveProject(p.id)}>Archive</Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
