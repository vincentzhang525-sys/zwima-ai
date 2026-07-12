"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ORG_ROLES, roleLabel } from "@/lib/rbac";
import type { OrgRole } from "@prisma/client";

type Member = {
  id: string;
  role: OrgRole;
  invitedEmail: string | null;
  user: { id: string; email: string; companyName: string | null };
};

type Org = {
  id: string;
  name: string;
  owner: { email: string };
  members: Member[];
};

export function TeamClient() {
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("DEVELOPER");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/team");
    const data = await res.json();
    setOrg(data.organization ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createOrg(e: FormEvent) {
    e.preventDefault();
    await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name }),
    });
    load();
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invite", email, role }),
    });
    setEmail("");
    load();
  }

  async function updateRole(memberId: string, newRole: OrgRole) {
    await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role: newRole }),
    });
    load();
  }

  async function removeMember(memberId: string) {
    if (!confirm("Remove this member?")) return;
    await fetch("/api/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    load();
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;

  if (!org) {
    return (
      <Card>
        <CardTitle>Create Organization</CardTitle>
        <form onSubmit={createOrg} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="orgName">Organization name</Label>
            <Input id="orgName" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
          </div>
          <Button type="submit">Create</Button>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>{org.name}</CardTitle>
        <p className="mt-1 text-sm text-slate-500">Owner: {org.owner.email}</p>
      </Card>

      <Card>
        <CardTitle>Invite Member</CardTitle>
        <form onSubmit={invite} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
            >
              {ORG_ROLES.filter((r) => r !== "OWNER").map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">Invite</Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Members</CardTitle>
        {org.members.length === 0 ? (
          <EmptyState title="No members" />
        ) : (
          <div className="mt-4 space-y-3">
            {org.members.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div>
                  <p className="font-medium">{m.user.email}</p>
                  <p className="text-sm text-slate-500">{m.invitedEmail ? `Invited: ${m.invitedEmail}` : roleLabel(m.role)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {m.role !== "OWNER" && (
                    <>
                      <select
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
                        value={m.role}
                        onChange={(e) => updateRole(m.id, e.target.value as OrgRole)}
                      >
                        {ORG_ROLES.filter((r) => r !== "OWNER").map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </select>
                      <Button variant="danger" size="sm" onClick={() => removeMember(m.id)}>
                        Remove
                      </Button>
                    </>
                  )}
                  {m.role === "OWNER" && <span className="text-sm font-medium text-blue-600">Owner</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
