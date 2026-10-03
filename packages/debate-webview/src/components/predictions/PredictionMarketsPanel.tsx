"use client";

/**
 * @fileoverview Prediction markets — bet play-money points on who wins a
 * debate, who wins a tournament, and whose Glicko rating goes up.
 *
 * One read (`GET /api/predictions`) fills the page: the viewer's wallet (the
 * 1000 starting points are granted on the first visit), the open markets,
 * recently settled ones, and the richest wallets. Every bet, new market or
 * settlement refreshes the whole board, since one bet moves every price in
 * its market.
 *
 * Pricing and settlement are the `debate-predictions` package; the routes are
 * `apps/debate-ai.com/app/api/predictions`.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Coins, History, Loader2, Plus, TrendingUp, Trophy } from "lucide-react";
import { KIND_LABELS, formatPoints, type MarketKind, type PredictionBoardResponse } from "@debate/predictions";
import { fetchPredictionBoard } from "@debate/predictions/client";

import { cn } from "../../lib/ui/lib/utils";
import { MarketCard } from "./MarketCard";
import { NewMarketForm } from "./NewMarketForm";

type Filter = "all" | MarketKind;

function Block({
  title,
  icon,
  description,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
            {icon}
          </span>
          <div>
            <h2 className="text-base font-semibold leading-none">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function PredictionMarketsPanel({ className }: { className?: string }) {
  const [board, setBoard] = useState<PredictionBoardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  const load = useCallback(async () => {
    try {
      setBoard(await fetchPredictionBoard());
      setNow(Math.floor(Date.now() / 1000));
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not load the markets.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { open, settled } = useMemo(() => {
    const markets = (board?.markets ?? []).filter((market) => filter === "all" || market.kind === filter);
    return {
      open: markets.filter((market) => market.status === "open"),
      settled: markets.filter((market) => market.status !== "open"),
    };
  }, [board?.markets, filter]);

  if (!board) {
    return error ? (
      <p role="alert" className={cn("text-sm text-destructive", className)}>
        {error}{" "}
        <button type="button" onClick={() => void load()} className="font-medium underline">
          Try again
        </button>
      </p>
    ) : (
      <p className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading the markets…
      </p>
    );
  }

  const { viewer, wallet } = board;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Block
        title="Your points"
        icon={<Coins className="h-4 w-4" />}
        description="Points are play money: everyone starts with 1,000, and they can't be bought or cashed out."
        action={
          wallet ? (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold tabular-nums text-primary">
              {formatPoints(wallet.balance)}
            </span>
          ) : null
        }
      >
        {!viewer ? (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <a href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </a>{" "}
            to get your 1,000 points and start betting.
          </p>
        ) : viewer.isAnonymous ? (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Guest accounts can watch the markets. Create an account to get your 1,000 points.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Buy shares in an outcome; each share pays 1 point if it happens. Prices are the market's odds and move
            with every bet.
          </p>
        )}
      </Block>

      <Block
        title="Open markets"
        icon={<TrendingUp className="h-4 w-4" />}
        action={
          wallet && !creating ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Open a market
            </button>
          ) : null
        }
      >
        {creating ? (
          <NewMarketForm
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              void load();
            }}
          />
        ) : null}

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Market type">
          {(["all", "debate", "tournament", "rating"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={filter === option}
              onClick={() => setFilter(option)}
              className={cn(
                "h-7 rounded-full border px-3 text-xs font-medium",
                filter === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent",
              )}
            >
              {option === "all" ? "All" : KIND_LABELS[option]}
            </button>
          ))}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open markets here yet.{wallet ? " Open the first one." : ""}</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {open.map((market) => (
              <MarketCard key={market.id} market={market} wallet={wallet} now={now} onChanged={() => void load()} />
            ))}
          </div>
        )}
      </Block>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Block title="Settled" icon={<History className="h-4 w-4" />}>
          {settled.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has settled yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {settled.map((market) => (
                <MarketCard key={market.id} market={market} wallet={wallet} now={now} onChanged={() => void load()} />
              ))}
            </div>
          )}
        </Block>

        <Block title="Top forecasters" icon={<Trophy className="h-4 w-4" />}>
          {board.leaders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one has a wallet yet.</p>
          ) : (
            <ol className="flex flex-col gap-1.5 text-sm">
              {board.leaders.map((leader, index) => (
                <li
                  key={leader.id}
                  className={cn("flex items-center justify-between gap-2", leader.id === viewer?.id && "font-semibold text-primary")}
                >
                  <span className="truncate">
                    <span className="mr-2 tabular-nums text-muted-foreground">{index + 1}.</span>
                    {leader.id === viewer?.id ? "You" : null}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatPoints(leader.balance)}</span>
                </li>
              ))}
            </ol>
          )}
        </Block>
      </div>
    </div>
  );
}
