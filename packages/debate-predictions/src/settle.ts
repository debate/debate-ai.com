/**
 * @fileoverview Settling a market: who gets paid what, and the rules that turn
 * hosted Tabroom data and `debate-rankings` ratings into a result.
 *
 * Everything here is pure. The queries in `apps/debate-ai.com/lib/predictions`
 * read the rows and write the result; deciding what the rows mean happens
 * here, where it can be tested without a database.
 *
 * @module debate-predictions/settle
 */

import type { MarketOutcome, MarketPosition } from "./types";

/** One bet, as settlement needs it. */
export interface SettlementBet {
  userId: string;
  outcomeId: string;
  stake: number;
  shares: number;
}

/**
 * Points owed to each bettor.
 *
 * - A winner is paid one point per share held on `winner`, rounded down once
 *   per person (not per bet), so splitting a position never costs a point.
 * - `winner === null` voids the market: every stake is refunded in full.
 *
 * Bettors owed nothing are absent from the map.
 */
export function settlePayouts(bets: readonly SettlementBet[], winner: string | null): Map<string, number> {
  const owed = new Map<string, number>();
  for (const bet of bets) {
    if (winner === null) {
      owed.set(bet.userId, (owed.get(bet.userId) ?? 0) + bet.stake);
    } else if (bet.outcomeId === winner) {
      owed.set(bet.userId, (owed.get(bet.userId) ?? 0) + bet.shares);
    }
  }
  for (const [userId, amount] of owed) {
    const points = Math.floor(amount + 1e-9);
    if (points > 0) owed.set(userId, points);
    else owed.delete(userId);
  }
  return owed;
}

/** One person's positions, summed per outcome from their bets. */
export function positionsFromBets(bets: readonly Omit<SettlementBet, "userId">[]): MarketPosition[] {
  const byOutcome = new Map<string, MarketPosition>();
  for (const bet of bets) {
    const position = byOutcome.get(bet.outcomeId) ?? { outcomeId: bet.outcomeId, shares: 0, staked: 0 };
    position.shares += bet.shares;
    position.staked += bet.stake;
    byOutcome.set(bet.outcomeId, position);
  }
  return [...byOutcome.values()];
}

/** The outcome id a hosted Tabroom entry is listed under. */
export function entryOutcomeId(entryId: number): string {
  return `entry:${entryId}`;
}

/** The two outcomes of every `rating` market. */
export const RATING_OUTCOMES: readonly MarketOutcome[] = [
  { id: "yes", label: "Rating rises" },
  { id: "no", label: "Rating doesn't rise" },
];

/** What a settlement rule decided. */
export type Decision =
  | { status: "pending" }
  | { status: "winner"; outcomeId: string; note: string }
  | { status: "void"; note: string };

/** One ballot on a hosted Tabroom panel, as the rule needs it. */
export interface PanelBallot {
  judge: number | null;
  entry: number | null;
  /** The ballot's `winloss` score: true for a win, false for a loss, null if not entered. */
  win: boolean | null;
  bye: boolean;
  forfeit: boolean;
}

/**
 * Who won a hosted Tabroom round.
 *
 * Each judge casts one vote: the entry their `winloss = 1` ballot names. The
 * round is decided once every judge on it has voted, and the entry with the
 * most votes wins. A bye, a forfeit or a split with no majority voids the
 * market, since there is no debate result to have predicted.
 */
export function decidePanel(ballots: readonly PanelBallot[]): Decision {
  if (ballots.length === 0) return { status: "pending" };
  if (ballots.some((b) => b.bye)) return { status: "void", note: "The round was a bye." };
  if (ballots.some((b) => b.forfeit)) return { status: "void", note: "The round was forfeited." };

  const judges = new Map<string, PanelBallot[]>();
  for (const ballot of ballots) {
    const key = String(ballot.judge ?? "none");
    judges.set(key, [...(judges.get(key) ?? []), ballot]);
  }

  const votes = new Map<number, number>();
  for (const judgeBallots of judges.values()) {
    const winner = judgeBallots.find((b) => b.win === true && b.entry !== null);
    if (!winner) return { status: "pending" };
    votes.set(winner.entry!, (votes.get(winner.entry!) ?? 0) + 1);
  }

  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) {
    return { status: "void", note: "The ballots split evenly." };
  }
  const [entry, count] = ranked[0];
  return {
    status: "winner",
    outcomeId: entryOutcomeId(entry),
    note: `Won on ${count} of ${judges.size} ballot${judges.size === 1 ? "" : "s"}.`,
  };
}

/** One published result set for a hosted Tabroom event. */
export interface EventResultSet {
  label: string | null;
  /** Tabroom flags bracket (elimination) result sets. */
  bracket: boolean;
  published: boolean;
  /** The entry ranked first, if any. */
  topEntry: number | null;
}

/** Labels Tabroom uses for an event's final placings. */
const FINAL_RESULTS = /\b(final|champion|places?|placement|elim|bracket)/i;

/**
 * Who won a hosted Tabroom event: the first-ranked entry in a published final
 * result set. Prelim seeds are not a result, so an event that has published
 * only those is still pending.
 */
export function decideEvent(sets: readonly EventResultSet[]): Decision {
  const final = sets.find(
    (set) => set.published && set.topEntry !== null && (set.bracket || FINAL_RESULTS.test(set.label ?? "")),
  );
  if (!final) return { status: "pending" };
  return {
    status: "winner",
    outcomeId: entryOutcomeId(final.topEntry!),
    note: `Placed first in ${final.label?.trim() || "the final results"}.`,
  };
}

/**
 * Whether a team's rating rose: compared once betting has closed. A team
 * that has dropped out of the rankings voids the market.
 */
export function decideRating(baseline: number, current: number | null, closed: boolean): Decision {
  if (!closed) return { status: "pending" };
  if (current === null || !Number.isFinite(current)) {
    return { status: "void", note: "The team is no longer in the rankings." };
  }
  const shown = (value: number) => value.toFixed(1);
  if (current > baseline + 1e-9) {
    return { status: "winner", outcomeId: "yes", note: `Rating rose from ${shown(baseline)} to ${shown(current)}.` };
  }
  return {
    status: "winner",
    outcomeId: "no",
    note: current < baseline - 1e-9
      ? `Rating fell from ${shown(baseline)} to ${shown(current)}.`
      : `Rating held at ${shown(current)}.`,
  };
}
