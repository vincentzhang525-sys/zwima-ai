"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

/**
 * Manual account/data deletion request entry (GAP-011).
 * Does not auto-erase data and does not send email.
 */
export function AccountDeletionRequestCard() {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/account/deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }
      setMessage(
        data.message ||
          "Deletion request recorded for manual review. No automated erasure was performed.",
      );
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card data-testid="account-deletion-request">
      <CardTitle>Account &amp; data deletion</CardTitle>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Closed Beta does not offer fully automated account erasure yet. Submit a request for
        manual review. No email is sent by this form.
      </p>
      <div className="mt-4">
        <Label htmlFor="deletion-reason">Reason (optional)</Label>
        <Input
          id="deletion-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional context for the review team"
        />
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {message ? (
        <p className="mt-2 text-sm text-green-700 dark:text-green-400" data-testid="deletion-request-ok">
          {message}
        </p>
      ) : null}
      <Button
        type="button"
        className="mt-4"
        disabled={busy}
        onClick={submit}
        data-testid="submit-deletion-request"
      >
        {busy ? "Submitting…" : "Submit deletion request"}
      </Button>
    </Card>
  );
}
