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

interface UserRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  sessions: number;
  total: number;
  docs: number;
  flows: number;
  rounds: number;
  wordCountRounds: number;
  judgeDecisions: number;
  speeches: number;
  practiceRounds: number;
  drills: number;
}

interface UsersResponse {
  users: UserRow[];
  page: number;
  limit: number;
  pageCount: number;
  matchedUsers: number;
  totals: Record<string, number>;
}

/**
 * The usage counters, in table order. `key` matches both the API response
 * field and the `sort` parameter it accepts, so a header click maps straight
 * onto a server-side ORDER BY.
 */
const USAGE_COLUMNS = [
  { key: "docs", label: "Docs", hint: "REASON editor documents" },
  { key: "flows", label: "Flows", hint: "Saved flows" },
  { key: "rounds", label: "Rounds", hint: "Saved rounds" },
  { key: "wordCountRounds", label: "Words", hint: "Saved word-count rounds" },
  { key: "judgeDecisions", label: "Judging", hint: "Saved judge decisions" },
  { key: "speeches", label: "Speeches", hint: "Speech documents sent" },
  { key: "practiceRounds", label: "vs AI", hint: "Practice-vs-AI rounds" },
  { key: "drills", label: "Drills", hint: "Saved drill sets" },
] as const;

const SUMMARY_TILES = [
  { key: "users", label: "Users" },
  { key: "sessions", label: "Sessions" },
  { key: "activity", label: "Saved items" },
  ...USAGE_COLUMNS.map(({ key, label }) => ({ key, label })),
] as const;

const PAGE_SIZE = 25;

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

/** Compact "how long ago", so dormant accounts stand out while scanning. */
function formatRelative(value: string | null) {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function UsersTable() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hideAnonymous, setHideAnonymous] = useState(false);
  const [sort, setSort] = useState<string>("joined");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sort,
        dir,
      });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (hideAnonymous) params.set("hideAnonymous", "true");
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `Request failed: ${res.status}`);
      setData(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, sort, dir, debouncedSearch, hideAnonymous]);

  useEffect(() => {
    load();
  }, [load]);

  /** First click on a column sorts it descending; clicking it again flips. */
  const toggleSort = (key: string) => {
    if (sort === key) {
      setDir((current) => (current === "desc" ? "asc" : "desc"));
    } else {
      setSort(key);
      setDir(key === "name" || key === "email" ? "asc" : "desc");
    }
    setPage(1);
  };

  const users = data?.users ?? [];
  const pageCount = data?.pageCount ?? 1;

  const sortIndicator = (key: string) => (sort === key ? (dir === "asc" ? " ↑" : " ↓") : "");

  const headerButton = (key: string, label: string, hint?: string) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      title={hint}
      className={`hover:text-foreground transition-colors ${
        sort === key ? "text-foreground font-medium" : ""
      }`}
    >
      {label}
      {sortIndicator(key)}
    </button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>
          Every account with what it has actually saved — documents, flows, rounds, judging,
          speeches, practice rounds and drills. Click a column to sort by it across all users.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-11">
            {SUMMARY_TILES.map((tile) => (
              <div key={tile.key} className="rounded-lg border px-2 py-2 text-center">
                <div className="text-lg font-semibold tabular-nums">
                  {(data.totals[tile.key] ?? 0).toLocaleString()}
                </div>
                <div className="text-muted-foreground text-xs">{tile.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email…"
            className="max-w-xs"
          />
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hideAnonymous}
              onChange={(event) => {
                setHideAnonymous(event.target.checked);
                setPage(1);
              }}
            />
            Hide anonymous
          </label>
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            {isLoading ? "Loading…" : "Refresh"}
          </Button>
          {data && (
            <span className="text-muted-foreground text-sm">
              {data.matchedUsers.toLocaleString()} matching
            </span>
          )}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="py-2 pr-3 font-normal">{headerButton("name", "User")}</th>
                <th className="px-2 py-2 font-normal">{headerButton("joined", "Joined")}</th>
                <th className="px-2 py-2 font-normal">
                  {headerButton("lastActive", "Last active", "Newest session activity")}
                </th>
                <th className="px-2 py-2 text-right font-normal">
                  {headerButton("sessions", "Logins", "Session rows for this account")}
                </th>
                {USAGE_COLUMNS.map((column) => (
                  <th key={column.key} className="px-2 py-2 text-right font-normal">
                    {headerButton(column.key, column.label, column.hint)}
                  </th>
                ))}
                <th className="py-2 pl-2 text-right font-normal">
                  {headerButton("total", "Total", "All saved items combined")}
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id} className="hover:bg-accent/40 border-b transition-colors">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      {row.image ? (
                        <img
                          src={row.image}
                          alt=""
                          className="size-7 shrink-0 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs">
                          {(row.name || row.email || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5 truncate font-medium">
                          {row.name || "—"}
                          {row.isAnonymous && (
                            <Badge variant="secondary" className="font-normal">
                              anon
                            </Badge>
                          )}
                          {!row.emailVerified && !row.isAnonymous && (
                            <Badge variant="outline" className="font-normal">
                              unverified
                            </Badge>
                          )}
                        </span>
                        <span className="text-muted-foreground truncate text-xs">{row.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted-foreground px-2 py-2 text-xs whitespace-nowrap">
                    {formatDate(row.createdAt)}
                  </td>
                  <td
                    className="text-muted-foreground px-2 py-2 text-xs whitespace-nowrap"
                    title={row.lastActiveAt ? formatDate(row.lastActiveAt) : undefined}
                  >
                    {formatRelative(row.lastActiveAt)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    <UsageCell value={row.sessions} />
                  </td>
                  {USAGE_COLUMNS.map((column) => (
                    <td key={column.key} className="px-2 py-2 text-right tabular-nums">
                      <UsageCell value={row[column.key]} />
                    </td>
                  ))}
                  <td className="py-2 pl-2 text-right font-medium tabular-nums">
                    <UsageCell value={row.total} />
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={USAGE_COLUMNS.length + 5}
                    className="text-muted-foreground py-6 text-center text-sm"
                  >
                    {isLoading ? "Loading users…" : "No users match this filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            Page {data?.page ?? page} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={isLoading || page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => current + 1)}
              disabled={isLoading || page >= pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Zeroes are dimmed so the columns a user actually uses pop out of the grid. */
function UsageCell({ value }: { value: number }) {
  return value === 0 ? (
    <span className="text-muted-foreground/40">0</span>
  ) : (
    <span>{value.toLocaleString()}</span>
  );
}
