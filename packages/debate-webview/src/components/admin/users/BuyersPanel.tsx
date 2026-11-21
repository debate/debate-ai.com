"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../../ui/primitives/badge";
import { Button } from "../../../ui/primitives/button";
import { Input } from "../../../ui/primitives/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card";

/** One row of `/api/admin/buyers` (apps/debate-web/lib/admin/buyers.ts). */
export interface BuyerRow {
  userId: string | null;
  name: string | null;
  email: string | null;
  plan: string | null;
  status: string | null;
  activeSubscription: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  topUpCents: number;
  filesBought: number;
  fileSpendCents: number;
  lastPurchaseAt: string | null;
}

export interface BuyerTotals {
  buyers: number;
  activeSubscribers: number;
  monthlyRecurringCents: number;
  topUpCents: number;
  filesSold: number;
  fileSalesCents: number;
}

type Filter = "all" | "subscribers" | "wallet";

/** Whole cents as "$12.50". */
export function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

/**
 * Users who have bought something: Pro VIP / Research Team subscribers,
 * wallet top-ups and file-market purchases, one row per account with the
 * money totals on top.
 */
export function BuyersPanel() {
  const [buyers, setBuyers] = useState<BuyerRow[] | null>(null);
  const [totals, setTotals] = useState<BuyerTotals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/buyers", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not load buyers");
      setBuyers(data.buyers);
      setTotals(data.totals);
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

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (buyers ?? []).filter((row) => {
      if (filter === "subscribers" && !row.plan) return false;
      if (filter === "wallet" && row.topUpCents === 0 && row.filesBought === 0) return false;
      if (!query) return true;
      return `${row.name ?? ""} ${row.email ?? ""}`.toLowerCase().includes(query);
    });
  }, [buyers, search, filter]);

  return (
    <Card id="buyers">
      <CardHeader>
        <CardTitle>Buyers</CardTitle>
        <CardDescription>
          Everyone who has paid: plan subscribers, wallet top-ups and files bought from the file market.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {totals && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Buyers" value={totals.buyers.toLocaleString()} />
            <Stat
              label="Active subscribers"
              value={totals.activeSubscribers.toLocaleString()}
              hint={`${formatDollars(totals.monthlyRecurringCents)} / month`}
            />
            <Stat label="Wallet top-ups" value={formatDollars(totals.topUpCents)} />
            <Stat
              label="Files sold"
              value={totals.filesSold.toLocaleString()}
              hint={formatDollars(totals.fileSalesCents)}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
            className="h-8 min-w-0 flex-1 sm:max-w-xs"
          />
          {(["all", "subscribers", "wallet"] as const).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
            >
              {key === "all" ? "All" : key === "subscribers" ? "Subscribers" : "Wallet & files"}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={load} disabled={isLoading}>
            {isLoading ? "Loading…" : "Refresh"}
          </Button>
        </div>

        {error && <p className="text-destructive">{error}</p>}
        {buyers === null && !error && <p className="text-muted-foreground">Loading…</p>}
        {buyers !== null && visible.length === 0 && (
          <p className="text-muted-foreground">{buyers.length === 0 ? "No one has bought anything yet." : "No buyers match."}</p>
        )}

        {visible.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl border-collapse">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="py-2 pr-3 font-normal">User</th>
                  <th className="px-2 py-2 font-normal">Plan</th>
                  <th className="px-2 py-2 font-normal">Renews / ends</th>
                  <th className="px-2 py-2 text-right font-normal">Top-ups</th>
                  <th className="px-2 py-2 text-right font-normal">Files bought</th>
                  <th className="py-2 pl-2 font-normal">Last purchase</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr key={row.userId ?? `${row.email}-${index}`} className="hover:bg-accent/40 border-b transition-colors">
                    <td className="py-2 pr-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{row.name || "—"}</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {row.email || "—"}
                          {!row.userId && " · not linked to an account"}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      {row.plan ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{row.plan}</span>
                          <Badge variant={row.activeSubscription ? "default" : "outline"} className="font-normal">
                            {row.status ?? "unknown"}
                          </Badge>
                          {row.cancelAtPeriodEnd && row.activeSubscription && (
                            <Badge variant="secondary" className="font-normal">
                              canceling
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">{row.plan ? formatDate(row.currentPeriodEnd) : "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {row.topUpCents ? formatDollars(row.topUpCents) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {row.filesBought ? `${row.filesBought} · ${formatDollars(row.fileSpendCents)}` : "—"}
                    </td>
                    <td className="py-2 pl-2">{formatDate(row.lastPurchaseAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
    </div>
  );
}
