/**
 * @fileoverview Small display helpers the markets page shares, kept here so
 * they are tested once.
 *
 * @module debate-predictions/format
 */

import type { MarketKind, MarketSource } from "./types";

/** A price (0–1) as a whole percentage, never showing a live outcome as 0% or 100%. */
export function formatPercent(price: number): string {
  const percent = price * 100;
  if (percent > 0 && percent < 1) return "<1%";
  if (percent < 100 && percent > 99) return ">99%";
  return `${Math.round(percent)}%`;
}

/** Points with thousands separators. */
export function formatPoints(points: number): string {
  return `${Math.floor(points).toLocaleString("en-US")} pts`;
}

/** "closes in 3h", "closes in 2d", "closed". */
export function describeClose(closesAt: number, now: number): string {
  const seconds = closesAt - now;
  if (seconds <= 0) return "betting closed";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `closes in ${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `closes in ${hours}h`;
  return `closes in ${Math.floor(hours / 24)}d`;
}

export const KIND_LABELS: Record<MarketKind, string> = {
  debate: "Debate",
  tournament: "Tournament winner",
  rating: "Rating move",
};

/** One line on how a market settles. */
export function describeSource(source: MarketSource): string {
  switch (source.type) {
    case "tabroom-panel":
      return "Settles itself from the hosted round's ballots.";
    case "tabroom-event":
      return "Settles itself from the hosted event's final results.";
    case "rating":
      return `Settles itself at close against ${source.name} (${source.school})'s rating of ${source.baseline.toFixed(1)} when it opened.`;
    default:
      return "Settled by its creator or a moderator.";
  }
}
