"use client";

/**
 * @fileoverview One prediction market: its outcomes with live prices, the
 * viewer's position, a bet form with a live quote, and — for whoever may
 * settle it by hand — the settle and void controls.
 */

import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, CircleSlash, Coins, Loader2, Trophy } from "lucide-react";
import {
  KIND_LABELS,
  describeClose,
  describeSource,
  formatPercent,
  formatPoints,
  quoteBet,
  type PredictionMarket,
  type PredictionWallet,
} from "debate-predictions";
import { placeBet, resolveMarket } from "debate-predictions/client";

import { cn } from "../../lib/ui/lib/utils";

export const inputClass =
  "w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const pillButton =
  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40";

export interface MarketCardProps {
  market: PredictionMarket;
  wallet: PredictionWallet | null;
  /** Unix seconds, so every card on the board agrees on what has closed. */
  now: number;
  /** Called after a bet or settlement, to refresh the board. */
  onChanged: () => void;
}

export function MarketCard({ market, wallet, now, onChanged }: MarketCardProps) {
  const open = market.status === "open" && market.closesAt > now;
  const [outcomeId, setOutcomeId] = useState(market.outcomes[0]?.id ?? "");
  const [stake, setStake] = useState("50");
  const [busy, setBusy] = useState<"bet" | "settle" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settleOutcome, setSettleOutcome] = useState("");

  const stakeValue = Number(stake);
  const quote = useMemo(() => {
    const index = market.outcomes.findIndex((outcome) => outcome.id === outcomeId);
    if (index === -1 || !Number.isInteger(stakeValue) || stakeValue < 1) return null;
    return quoteBet(
      market.outcomes.map((outcome) => outcome.shares),
      market.liquidity,
      index,
      stakeValue,
    );
  }, [market.outcomes, market.liquidity, outcomeId, stakeValue]);

  const winner = market.outcomes.find((outcome) => outcome.id === market.resolvedOutcome);

  async function handleBet(event: FormEvent) {
    event.preventDefault();
    setBusy("bet");
    setError(null);
    try {
      await placeBet(market.id, { outcomeId, stake: stakeValue });
      onChanged();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not place that bet.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSettle(outcome: string | null) {
    setBusy("settle");
    setError(null);
    try {
      await resolveMarket(market.id, { outcomeId: outcome });
      onChanged();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not settle that market.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{KIND_LABELS[market.kind]}</span>
          <span>{market.status === "open" ? describeClose(market.closesAt, now) : market.status === "void" ? "voided" : "settled"}</span>
          <span aria-hidden="true">·</span>
          <span>{formatPoints(market.volume)} staked</span>
        </div>
        <h3 className="text-sm font-semibold leading-snug">{market.title}</h3>
        {market.description ? <p className="text-xs text-muted-foreground">{market.description}</p> : null}
        <p className="text-xs text-muted-foreground">
          {describeSource(market.source)}
          {market.creator ? ` Opened by ${market.creator.name}.` : ""}
        </p>
      </header>

      <ul className="flex flex-col gap-1.5" aria-label="Outcomes">
        {market.outcomes.map((outcome) => {
          const held = market.positions.find((position) => position.outcomeId === outcome.id);
          const won = market.resolvedOutcome === outcome.id;
          return (
            <li key={outcome.id} className="relative overflow-hidden rounded-md border border-border">
              <div
                className={cn("absolute inset-y-0 left-0", won ? "bg-emerald-500/20" : "bg-primary/10")}
                style={{ width: `${Math.round(outcome.price * 100)}%` }}
                aria-hidden="true"
              />
              <div className="relative flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  {won ? <Trophy className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Winner" /> : null}
                  <span className="truncate">{outcome.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 tabular-nums">
                  {held ? (
                    <span className="text-xs text-muted-foreground">
                      you: {held.shares.toFixed(1)} sh / {formatPoints(held.staked)}
                    </span>
                  ) : null}
                  <span className="font-semibold">{formatPercent(outcome.price)}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {market.status !== "open" ? (
        <p className="text-xs text-muted-foreground">
          {market.status === "void" ? "Voided — every stake was refunded." : `Won by ${winner?.label ?? "—"}.`}{" "}
          {market.resolutionNote}
          {market.payout !== null ? ` You got back ${formatPoints(market.payout)}.` : ""}
        </p>
      ) : null}

      {open && wallet ? (
        <form onSubmit={handleBet} className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
          <div className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
            <label className="sr-only" htmlFor={`bet-outcome-${market.id}`}>
              Outcome
            </label>
            <select
              id={`bet-outcome-${market.id}`}
              value={outcomeId}
              onChange={(event) => setOutcomeId(event.target.value)}
              className={cn(inputClass, "h-8")}
            >
              {market.outcomes.map((outcome) => (
                <option key={outcome.id} value={outcome.id}>
                  {outcome.label} ({formatPercent(outcome.price)})
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`bet-stake-${market.id}`}>
              Stake in points
            </label>
            <input
              id={`bet-stake-${market.id}`}
              type="number"
              min={1}
              max={wallet.balance}
              step={1}
              value={stake}
              onChange={(event) => setStake(event.target.value)}
              className={cn(inputClass, "h-8 tabular-nums")}
            />
            <button
              type="submit"
              disabled={busy !== null || !quote || stakeValue > wallet.balance}
              className={cn(pillButton, "bg-primary text-primary-foreground hover:opacity-90")}
            >
              {busy === "bet" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Coins className="h-3.5 w-3.5" aria-hidden="true" />}
              Bet
            </button>
          </div>
          {quote ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              Buys {quote.shares.toFixed(1)} shares at {formatPercent(quote.averagePrice)} each; pays{" "}
              {formatPoints(quote.payoutIfWin)} if it wins (moves the price to {formatPercent(quote.priceAfter)}).
            </p>
          ) : null}
        </form>
      ) : null}

      {market.canResolve ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
          <label className="sr-only" htmlFor={`settle-${market.id}`}>
            Winning outcome
          </label>
          <select
            id={`settle-${market.id}`}
            value={settleOutcome}
            onChange={(event) => setSettleOutcome(event.target.value)}
            className={cn(inputClass, "h-8 max-w-xs")}
          >
            <option value="">Pick the winner…</option>
            {market.outcomes.map((outcome) => (
              <option key={outcome.id} value={outcome.id}>
                {outcome.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy !== null || !settleOutcome}
            onClick={() => void handleSettle(settleOutcome)}
            className={cn(pillButton, "border border-border bg-background hover:bg-accent")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Settle
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void handleSettle(null)}
            className={cn(pillButton, "border border-border bg-background hover:bg-accent")}
          >
            <CircleSlash className="h-3.5 w-3.5" aria-hidden="true" />
            Void and refund
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </article>
  );
}
