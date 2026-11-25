"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../ui/primitives/button";
import { Input } from "../../../ui/primitives/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card";
import type { AdminFeedbackRow } from "../../../lib/feedback/feedback";

/**
 * Feedback sent from the Settings footer's Feedback dialog
 * (`GET /api/admin/feedback`), newest first, with a filter and delete.
 */
export function FeedbackPanel() {
  const [rows, setRows] = useState<AdminFeedbackRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/feedback", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not load feedback");
      setRows(data.feedback);
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

  const remove = useCallback(async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/feedback?id=${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not delete");
      setRows((current) => (current ?? []).filter((row) => row.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows ?? [];
    return (rows ?? []).filter((row) =>
      [row.email, row.message, row.userName ?? "", row.page ?? ""].some((field) => field.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  return (
    <Card id="feedback">
      <CardHeader>
        <CardTitle>Feedback</CardTitle>
        <CardDescription>
          Messages sent from the Feedback button in the Settings footer, newest first. Each sender can send one an
          hour.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Filter feedback"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by email or text"
            className="h-8 min-w-0 flex-1 sm:max-w-sm"
          />
          <span className="text-muted-foreground">{rows ? `${visible.length} of ${rows.length}` : ""}</span>
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
          <p className="text-muted-foreground">{rows.length === 0 ? "No feedback yet." : "Nothing matches that filter."}</p>
        )}

        {visible.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {visible.map((row) => (
              <li key={row.id} className="space-y-2 p-3" data-feedback-id={row.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <a href={`mailto:${row.email}`} className="truncate font-medium hover:underline">
                      {row.email}
                    </a>
                    <span className="text-muted-foreground truncate text-xs">
                      {row.userName ? `${row.userName} · ` : row.userId ? "" : "signed out · "}
                      {new Date(row.createdAt).toLocaleString()}
                      {row.page && ` · from ${row.page}`}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => remove(row.id)}
                    disabled={deletingId === row.id}
                  >
                    {deletingId === row.id ? "Deleting…" : "Delete"}
                  </Button>
                </div>
                <p className="whitespace-pre-wrap break-words">{row.message}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
