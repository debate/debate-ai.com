"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../../ui/primitives/badge";
import { Button } from "../../../ui/primitives/button";
import { Input } from "../../../ui/primitives/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card";
import {
  DELETION_CATEGORIES,
  MAX_DELETION_RESOLUTION_NOTE_LENGTH,
  type DeletionStatus,
} from "../../../lib/privacy/recording-release";

/** One row of `GET /api/admin/deletion-requests` (apps/debate-web/lib/privacy/store.ts). */
export interface AdminDeletionRequest {
  id: number;
  userId: string;
  name: string | null;
  email: string | null;
  scope: string;
  categories: string[];
  details: string;
  status: string;
  createdAt: string;
}

type Filter = "pending" | "all";

/** The category ids of a request as their Settings → Privacy labels. */
export function describeDeletionScope(request: Pick<AdminDeletionRequest, "scope" | "categories">): string {
  if (request.scope === "all") return "Everything";
  const labels = request.categories.map((id) => DELETION_CATEGORIES.find((c) => c.id === id)?.label ?? id);
  return labels.length > 0 ? labels.join(", ") : "Described in notes";
}

/** Whole days since `iso`, as "today" / "1 day" / "N days". */
export function waitingFor(iso: string, now: number = Date.now()): string {
  const days = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
  return days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  pending: "default",
  done: "secondary",
  declined: "outline",
};

/**
 * The queue of Settings → Privacy deletion requests. An admin does the
 * deletion by hand, then marks the request done (or declines it); either way
 * the requester gets a notification carrying the optional note.
 */
export function DeletionRequestsPanel() {
  const [requests, setRequests] = useState<AdminDeletionRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("pending");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/deletion-requests", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not load deletion requests");
      setRequests(data.requests);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = useCallback(
    async (id: number, status: DeletionStatus) => {
      setSavingId(id);
      try {
        const res = await fetch("/api/admin/deletion-requests", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status, note: notes[id] ?? "" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Could not update the request");
        setRequests((current) => (current ?? []).map((row) => (row.id === id ? { ...row, status } : row)));
        setNotes((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSavingId(null);
      }
    },
    [notes],
  );

  const pendingCount = useMemo(() => (requests ?? []).filter((row) => row.status === "pending").length, [requests]);
  const visible = useMemo(
    () => (requests ?? []).filter((row) => filter === "all" || row.status === "pending"),
    [requests, filter],
  );

  return (
    <Card id="deletion-requests">
      <CardHeader>
        <CardTitle>Deletion requests</CardTitle>
        <CardDescription>
          Requests filed from Settings → Privacy. Delete the data by hand, then mark the request done or declined —
          the user is notified, with your note if you add one. Nothing here deletes data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {(["pending", "all"] as const).map((key) => (
            <Button key={key} size="sm" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)}>
              {key === "pending" ? `Pending (${pendingCount})` : "All"}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={load} disabled={isLoading}>
            {isLoading ? "Loading…" : "Refresh"}
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {requests === null && !error && <p className="text-muted-foreground">Loading…</p>}
        {requests !== null && visible.length === 0 && (
          <p className="text-muted-foreground">
            {filter === "pending" ? "No pending deletion requests." : "No one has asked for a deletion yet."}
          </p>
        )}

        {visible.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {visible.map((row) => (
              <li key={row.id} className="space-y-2 p-3" data-request-id={row.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{row.name || "—"}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {row.email || row.userId} · filed {new Date(row.createdAt).toLocaleDateString()}
                      {row.status === "pending" && ` · waiting ${waitingFor(row.createdAt)}`}
                    </span>
                  </div>
                  <Badge variant={STATUS_BADGE[row.status] ?? "outline"} className="font-normal">
                    {row.status}
                  </Badge>
                </div>
                <p>
                  <span className="text-muted-foreground">Delete: </span>
                  {describeDeletionScope(row)}
                </p>
                {row.details && <p className="text-muted-foreground whitespace-pre-wrap break-words">{row.details}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label={`Note to ${row.name || row.email || "the user"}`}
                    value={notes[row.id] ?? ""}
                    maxLength={MAX_DELETION_RESOLUTION_NOTE_LENGTH}
                    onChange={(event) => {
                      const value = event.target.value;
                      setNotes((current) => ({ ...current, [row.id]: value }));
                    }}
                    placeholder="Optional note to the user"
                    className="h-8 min-w-0 flex-1 sm:max-w-sm"
                  />
                  {row.status === "pending" ? (
                    <>
                      <Button size="sm" onClick={() => setStatus(row.id, "done")} disabled={savingId === row.id}>
                        Mark done
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(row.id, "declined")}
                        disabled={savingId === row.id}
                      >
                        Decline
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus(row.id, "pending")}
                      disabled={savingId === row.id}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
