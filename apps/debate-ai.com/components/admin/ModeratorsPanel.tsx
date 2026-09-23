"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../lib/ui/primitives/button";
import { Badge } from "../../lib/ui/primitives/badge";
import { Input } from "../../lib/ui/primitives/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../lib/ui/primitives/card";

interface ModeratorRow {
  email: string;
  role: string;
  invitedBy: string | null;
  createdAt: string | number | null;
}

interface ModeratorsResponse {
  admins: string[];
  moderators: ModeratorRow[];
}

const DELIVERY_NOTES: Record<string, string> = {
  notified: "they were sent an in-app notification",
  emailed: "they were emailed an invite",
  none: "no email was sent (RESEND_API_KEY is not set) — let them know to sign in",
};

/**
 * Invite and remove moderators — people who can edit videos and debate rounds
 * (the library, reports and round queue) but not accounts, sync jobs or
 * uploads. Admins are listed read-only: they come from ADMIN_EMAIL /
 * ADMIN_EMAILS, not from here.
 */
export function ModeratorsPanel() {
  const [data, setData] = useState<ModeratorsResponse | null>(null);
  const [email, setEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/moderators");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Failed to load moderators");
      setData(body);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    setIsInviting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/moderators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Invite failed");
      setNotice(`${body.email} is now a moderator — ${DELIVERY_NOTES[body.delivery] ?? ""}.`);
      setEmail("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (address: string) => {
    setPending(address);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/moderators?email=${encodeURIComponent(address)}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Remove failed");
      setNotice(`${address} is no longer a moderator.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Moderators</CardTitle>
        <CardDescription>
          Moderators can edit published videos, their transcripts and linked videos, review video
          reports, and publish or reject queued debate rounds — from this page or the “Edit video”
          button on any watch page. They cannot see accounts, run sync jobs or upload data. Admins
          are set with the <code>ADMIN_EMAIL</code> / <code>ADMIN_EMAILS</code> environment
          variables.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleInvite} className="flex flex-wrap items-center gap-3">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="moderator@example.com"
            className="max-w-sm"
          />
          <Button type="submit" disabled={isInviting || !email.trim()}>
            {isInviting ? "Inviting…" : "Invite moderator"}
          </Button>
        </form>

        {error && <p className="text-destructive text-sm">{error}</p>}
        {notice && <p className="text-muted-foreground text-sm">{notice}</p>}

        <ul className="flex flex-col divide-y rounded-md border text-sm">
          {data?.admins.map((admin) => (
            <li key={`admin-${admin}`} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="truncate">{admin}</span>
              <Badge variant="secondary" className="font-normal">
                admin
              </Badge>
            </li>
          ))}
          {data?.moderators.map((moderator) => (
            <li key={moderator.email} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex min-w-0 flex-col">
                <span className="truncate">{moderator.email}</span>
                {moderator.invitedBy && (
                  <span className="text-muted-foreground truncate text-xs">
                    invited by {moderator.invitedBy}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="font-normal">
                  moderator
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRemove(moderator.email)}
                  disabled={pending === moderator.email}
                >
                  {pending === moderator.email ? "Removing…" : "Remove"}
                </Button>
              </div>
            </li>
          ))}
          {data && data.moderators.length === 0 && (
            <li className="text-muted-foreground px-3 py-2">No moderators yet.</li>
          )}
          {!data && !error && <li className="text-muted-foreground px-3 py-2">Loading…</li>}
        </ul>
      </CardContent>
    </Card>
  );
}
