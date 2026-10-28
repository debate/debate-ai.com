"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, TrendingUp, TrendingDown, Minus, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createMarket, placeBet, fetchPredictionBoard } from "@debate-ai/predictions/client";
import type { PredictionMarket, PredictionBoardResponse } from "@debate-ai/predictions";
import type { VideoType } from "../../../types/videos";
import { Button } from "../../../ui/primitives/button";
import { cn } from "../../../ui/lib/utils";

const OUTCOME_LABELS = {
  aff: "Affirmative wins",
  neg: "Negative wins",
} as const;

function formatPoints(n: number): string {
  return new Intl.NumberFormat().format(n);
}

function probabilityFromShares(shares: number, totalShares: number): number {
  if (totalShares === 0) return 50;
  return Math.round((shares / totalShares) * 100);
}

interface RoundPredictionMarket extends PredictionMarket {
  affShares: number;
  negShares: number;
  affProbability: number;
  negProbability: number;
}

function parseMarket(market: PredictionMarket): RoundPredictionMarket | null {
  if (market.kind !== "debate" || market.outcomes.length !== 2) return null;
  const affOutcome = market.outcomes.find((o) => o.label.toLowerCase().includes("aff"));
  const negOutcome = market.outcomes.find((o) => o.label.toLowerCase().includes("neg"));
  if (!affOutcome || !negOutcome) return null;

  const affPosition = market.positions?.find((p) => p.outcomeId === affOutcome.id);
  const negPosition = market.positions?.find((p) => p.outcomeId === negOutcome.id);
  const affShares = affPosition?.shares ?? 0;
  const negShares = negPosition?.shares ?? 0;
  const totalShares = affShares + negShares;

  return {
    ...market,
    affShares,
    negShares,
    affProbability: probabilityFromShares(affShares, totalShares),
    negProbability: probabilityFromShares(negShares, totalShares),
  };
}

export interface WatchRoundPredictionProps {
  video: VideoType;
  /** Whether the viewer is signed in; only signed-in viewers open markets and bet. */
  isAuthenticated: boolean;
  /** True while the session is still loading. */
  authLoading?: boolean;
}

export function WatchRoundPrediction({ video, isAuthenticated, authLoading = false }: WatchRoundPredictionProps) {
  const router = useRouter();

  const affTeam = video[9];
  const negTeam = video[10];
  const videoId = video[0] as string;
  const title = video[1] as string;

  const [market, setMarket] = useState<RoundPredictionMarket | null>(null);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [betting, setBetting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [closesAt, setClosesAt] = useState(() => {
    const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    date.setSeconds(0, 0);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });

  useEffect(() => {
    let cancelled = false;
    fetchPredictionBoard()
      .then((board: PredictionBoardResponse) => {
        if (cancelled) return;
        const roundMarket = board.markets
          .map(parseMarket)
          .find((m) => m && m.title.toLowerCase().includes(title.toLowerCase().slice(0, 50)));
        setMarket(roundMarket ?? null);
        setMarketsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setMarketsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [title]);

  async function handleCreateMarket(event: FormEvent) {
    event.preventDefault();
    if (!isAuthenticated) {
      router.push("/auth/signin");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const closesAtSeconds = Math.floor(new Date(closesAt).getTime() / 1000);
      const affLabel = `${OUTCOME_LABELS.aff} — ${affTeam}`;
      const negLabel = `${OUTCOME_LABELS.neg} — ${negTeam}`;
      await createMarket({
        kind: "debate",
        title: `Who wins ${title}?`,
        description: `Prediction market for the ${affTeam} (Aff) vs ${negTeam} (Neg) round.`,
        closesAt: closesAtSeconds,
        outcomes: [affLabel, negLabel],
      });
      setShowCreateForm(false);
      router.refresh();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not create market.");
    } finally {
      setCreating(false);
    }
  }

  async function handlePlaceBet(outcomeId: string, side: "aff" | "neg") {
    if (!market || !isAuthenticated) {
      router.push("/auth/signin");
      return;
    }
    setBetting(side);
    setError(null);
    try {
      await placeBet(market.id, { outcomeId, stake: 10 });
      router.refresh();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not place bet.");
    } finally {
      setBetting(null);
    }
  }

  if (authLoading || marketsLoading) {
    return (
      <section aria-label="Round prediction" className="space-y-2">
        <h2 className="text-sm font-semibold">Round prediction</h2>
        <div className="min-w-0 rounded-lg border bg-card p-3 space-y-3 animate-pulse">
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-muted rounded" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </div>
      </section>
    );
  }

  if (!affTeam || !negTeam) {
    return null;
  }

  return (
    <section aria-label="Round prediction" className="space-y-2">
      <h2 className="text-sm font-semibold">Round prediction</h2>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {market ? (
        <div className="min-w-0 rounded-lg border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Who wins?</h3>
            <span className="text-xs text-muted-foreground">
              Closes {new Date(market.closesAt * 1000).toLocaleDateString()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <OutcomeCard
              side="aff"
              label={OUTCOME_LABELS.aff}
              team={affTeam}
              probability={market.affProbability}
              shares={market.affShares}
              isBetting={betting === "aff"}
              onBet={() => handlePlaceBet(market.outcomes.find((o) => o.label.toLowerCase().includes("aff"))!.id, "aff")}
              disabled={!isAuthenticated || market.status !== "open"}
            />
            <OutcomeCard
              side="neg"
              label={OUTCOME_LABELS.neg}
              team={negTeam}
              probability={market.negProbability}
              shares={market.negShares}
              isBetting={betting === "neg"}
              onBet={() => handlePlaceBet(market.outcomes.find((o) => o.label.toLowerCase().includes("neg"))!.id, "neg")}
              disabled={!isAuthenticated || market.status !== "open"}
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Total shares: {formatPoints(market.affShares + market.negShares)}</span>
            {market.status !== "open" && (
              <span className="px-1.5 py-0.5 rounded bg-muted">
                {market.status === "resolved" ? "Settled" : market.status === "void" ? "Voided" : "Closed"}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            <Link href="/practice/predictions" className="underline hover:text-foreground">
              View all markets →
            </Link>
          </p>
        </div>
      ) : (
        <div className="min-w-0 rounded-lg border bg-card p-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            No prediction market exists for this round yet. Create one to bet on who will win.
          </p>

          {isAuthenticated ? (
            <>
              {showCreateForm ? (
                <form onSubmit={handleCreateMarket} className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                      Affirmative side
                      <input
                        type="text"
                        value={`${OUTCOME_LABELS.aff} — ${affTeam}`}
                        readOnly
                        className="rounded-md border bg-background px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                      Negative side
                      <input
                        type="text"
                        value={`${OUTCOME_LABELS.neg} — ${negTeam}`}
                        readOnly
                        className="rounded-md border bg-background px-2 py-1.5 text-sm"
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Betting closes
                    <input
                      type="datetime-local"
                      value={closesAt}
                      onChange={(e) => setClosesAt(e.target.value)}
                      required
                      className="rounded-md border bg-background px-2 py-1.5 text-sm"
                    />
                  </label>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={creating}>
                      {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create market"}
                    </Button>
                  </div>
                </form>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Create prediction market
                </Button>
              )}
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => router.push("/auth/signin")}>
              Sign in to create a market
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function OutcomeCard({
  side,
  label,
  team,
  probability,
  shares,
  isBetting,
  onBet,
  disabled,
}: {
  side: "aff" | "neg";
  label: string;
  team: string;
  probability: number;
  shares: number;
  isBetting: boolean;
  onBet: () => void;
  disabled: boolean;
}) {
  const isAff = side === "aff";
  return (
    <button
      onClick={onBet}
      disabled={disabled || isBetting}
      className={cn(
        "relative min-w-0 rounded-md border bg-card p-3 space-y-2 transition-colors",
        "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isAff ? "border-blue-200/50 dark:border-blue-800/50" : "border-red-200/50 dark:border-red-800/50",
      )}
      aria-label={`Bet on ${label} (${probability}% implied probability)`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            isAff ? "text-blue-400" : "text-red-400",
          )}
        >
          {isAff ? "AFF" : "NEG"}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{formatPoints(shares)} shares</span>
      </div>
      <div className="truncate font-medium">{team}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Implied probability</span>
          <span className="font-semibold tabular-nums">{probability}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-300",
              isAff ? "bg-blue-500" : "bg-red-500",
            )}
            style={{ width: `${probability}%` }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">Bet 10 pts</span>
        {isBetting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Button
            size="icon"
            variant={isAff ? "default" : "destructive"}
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onBet();
            }}
            disabled={disabled}
            aria-label={`Bet 10 points on ${label}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </button>
  );
}