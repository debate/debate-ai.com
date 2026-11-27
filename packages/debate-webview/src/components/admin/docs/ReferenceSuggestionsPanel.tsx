"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../ui/primitives/button";
import { Input } from "../../../ui/primitives/input";
import { Badge } from "../../../ui/primitives/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card";

type SuggestionStatus = "pending" | "approved" | "dismissed";

/** One row of `GET /api/admin/reference-suggestions`. */
export interface ReferenceSuggestionRow {
  id: string;
  page: string;
  refId: string;
  title: string;
  text: string;
  status: SuggestionStatus;
  userId: string | null;
  userName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

type Filter = SuggestionStatus | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

const STATUS_BADGE: Record<SuggestionStatus, "default" | "secondary" | "outline"> = {
  pending: "default",
  approved: "secondary",
  dismissed: "outline",
};

/**
 * Card text readers suggested for References entries with a red X or an
 * ellipsis (`GET /api/admin/reference-suggestions`): which entry, the text, who
 * sent it and when, with approve, dismiss, reopen and delete. Approving marks
 * the text as accepted; adding it to the page's References source is a
 * content edit made by hand.
 */
export function ReferenceSuggestionsPanel() {
  const [rows, setRows] = useState<ReferenceSuggestionRow[] | null>(null);
  const [counts, setCounts] = useState<Record<SuggestionStatus, number> | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin/reference-suggestions${params}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not load suggestions");
      setRows(data.suggestions);
      setCounts(data.counts);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = useCallback(
    async (id: string, status: SuggestionStatus) => {
      setBusyId(id);
      try {
        const res = await fetch("/api/admin/reference-suggestions", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Could not update the suggestion");
        await load();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/admin/reference-suggestions?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Could not delete");
        await load();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows ?? [];
    return (rows ?? []).filter((row) =>
      [row.title, row.refId, row.text, row.userName ?? ""].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [rows, query]);

  return (
    <Card id="reference-text">
      <CardHeader>
        <CardTitle>Reference text</CardTitle>
        <CardDescription>
          Full card text that readers suggested from the red X and ellipsis icons on the journal References pages,
          newest first. Anyone can submit, signed in or not.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(({ key, label }) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
            >
              {label}
              {key !== "all" && counts ? ` (${counts[key]})` : ""}
            </Button>
          ))}
          <Input
            aria-label="Filter suggestions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by reference or text"
            className="h-8 min-w-0 flex-1 sm:max-w-xs"
          />
          <Button size="sm" variant="outline" onClick={load} disabled={isLoading}>
            {isLoading ? "Loading…" : "Refresh"}
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {rows === null && !error && <p className="text-muted-foreground">Loading…</p>}
        {rows !== null && visible.length === 0 && (
          <p className="text-muted-foreground">
            {rows.length === 0 ? "No suggestions here yet." : "Nothing matches that filter."}
          </p>
        )}

        {visible.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {visible.map((row) => (
              <li key={row.id} className="space-y-2 p-3" data-suggestion-id={row.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <a
                      href={`${row.page}#${row.refId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium break-words hover:underline"
                    >
                      {row.title || row.refId}
                    </a>
                    <span className="text-muted-foreground text-xs break-all">
                      {row.refId} · {row.page}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(row.createdAt).toLocaleString()} · from{" "}
                      {row.userName || "an anonymous guest"}
                      {row.resolvedBy && row.resolvedAt
                        ? ` · ${row.status} by ${row.resolvedBy} ${new Date(row.resolvedAt).toLocaleString()}`
                        : ""}
                    </span>
                  </div>
                  <Badge variant={STATUS_BADGE[row.status]}>{row.status}</Badge>
                </div>

                <p className="bg-muted/40 max-h-64 overflow-y-auto rounded-md border p-2 break-words whitespace-pre-wrap">
                  {row.text}
                </p>
                <div className="flex flex-wrap gap-2">
                  {row.status !== "approved" && (
                    <Button size="sm" onClick={() => resolve(row.id, "approved")} disabled={busyId === row.id}>
                      Approve
                    </Button>
                  )}
                  {row.status !== "dismissed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolve(row.id, "dismissed")}
                      disabled={busyId === row.id}
                    >
                      Dismiss
                    </Button>
                  )}
                  {row.status !== "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolve(row.id, "pending")}
                      disabled={busyId === row.id}
                    >
                      Reopen
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => remove(row.id)} disabled={busyId === row.id}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
