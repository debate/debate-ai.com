"use client";

/**
 * @fileoverview Related prediction markets on a team profile: that team's
 * rating-up market (when they are in the division's top ten presets) and
 * major-tournament winner markets that list them as an outcome (Glenbrooks,
 * NDT, TOC, etc.).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins } from "lucide-react";
import { fetchPredictionBoard } from "../client";
import { marketsRelatedToTeam } from "../related-markets";
import type { PredictionMarket, PredictionWallet } from "../types";
import { MarketCard } from "./MarketCard";

export interface TeamRelatedMarketsProps {
  /** Stable entry hashes for this team across the divisions it appears in. */
  hashes: readonly string[];
  /** Optional team label for the empty/loading copy. */
  teamName?: string;
  className?: string;
}

/**
 * Loads the prediction board and shows markets that concern `hashes`.
 * Renders nothing while loading or when none match.
 */
export function TeamRelatedMarkets({ hashes, teamName, className = "" }: TeamRelatedMarketsProps) {
  const [markets, setMarkets] = useState<PredictionMarket[] | null>(null);
  const [wallet, setWallet] = useState<PredictionWallet | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setNow(Math.floor(Date.now() / 1000));
    return fetchPredictionBoard()
      .then((board) => {
        setMarkets(board.markets);
        setWallet(board.wallet);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load prediction markets.");
        setMarkets([]);
      });
  }, []);

  useEffect(() => {
    if (hashes.length === 0) {
      setMarkets([]);
      return;
    }
    void refresh();
  }, [hashes, refresh]);

  const related = useMemo(
    () => (markets ? marketsRelatedToTeam(markets, hashes) : []),
    [markets, hashes],
  );

  if (hashes.length === 0) return null;
  if (markets === null) {
    return (
      <section className={`rounded-lg border p-4 ${className}`} aria-busy="true">
        <p className="text-sm text-muted-foreground">Loading prediction markets…</p>
      </section>
    );
  }
  if (error && related.length === 0) {
    return (
      <section className={`rounded-lg border p-4 ${className}`}>
        <p className="text-sm text-muted-foreground">{error}</p>
      </section>
    );
  }
  if (related.length === 0) return null;

  const who = teamName?.trim() || "this team";

  return (
    <section className={`rounded-lg border p-3 sm:p-4 ${className}`} aria-labelledby="team-prediction-markets-heading">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 id="team-prediction-markets-heading" className="flex items-center gap-2 text-base font-semibold">
          <Coins className="h-4 w-4 text-amber-500" aria-hidden />
          Prediction markets
        </h2>
        <a href="/practice/predictions" className="text-xs text-muted-foreground underline underline-offset-4">
          All markets
        </a>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Markets about {who}: whether their rating rises this month, and major tournaments where they are listed among
        the favorites (Glenbrooks, NDT, TOC, and other nationals for their division).
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {related.map(({ market }) => (
          <MarketCard key={market.id} market={market} wallet={wallet} now={now} onChanged={() => void refresh()} />
        ))}
      </div>
    </section>
  );
}
