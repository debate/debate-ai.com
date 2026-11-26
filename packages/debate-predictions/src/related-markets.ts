/**
 * @fileoverview Pick prediction markets that concern one team — used on team
 * profile pages to show that team's rating market and any major-tournament
 * winner markets that list them as an outcome.
 *
 * @module debate-predictions/related-markets
 */

import type { PredictionMarket } from "./types";

/** How a market relates to the team. */
export type TeamMarketRelation = "rating" | "tournament";

export interface RelatedTeamMarket {
  market: PredictionMarket;
  relation: TeamMarketRelation;
}

/** Short prefix used in preset tournament outcome ids (`team:<16 hex>`). */
export function teamOutcomeIdPrefix(hash: string): string {
  return `team:${hash.toLowerCase().slice(0, 16)}`;
}

/**
 * Markets about this team: its rating-up presets (by hash), and tournament
 * winner markets that name it as an outcome. Open markets first, then by
 * close time.
 */
export function marketsRelatedToTeam(
  markets: readonly PredictionMarket[],
  hashes: readonly string[],
): RelatedTeamMarket[] {
  const keys = new Set(
    hashes.map((hash) => hash.toLowerCase()).filter((hash) => hash.length > 0),
  );
  if (keys.size === 0) return [];

  const prefixes = [...keys].map((hash) => teamOutcomeIdPrefix(hash));
  const out: RelatedTeamMarket[] = [];

  for (const market of markets) {
    if (market.source.type === "rating" && keys.has(market.source.hash.toLowerCase())) {
      out.push({ market, relation: "rating" });
      continue;
    }
    if (market.kind === "tournament" && market.outcomes.some((outcome) => prefixes.includes(outcome.id))) {
      out.push({ market, relation: "tournament" });
    }
  }

  return out.sort((a, b) => {
    const open = Number(b.market.status === "open") - Number(a.market.status === "open");
    if (open) return open;
    const relation = (a.relation === "rating" ? 0 : 1) - (b.relation === "rating" ? 0 : 1);
    if (relation) return relation;
    return a.market.closesAt - b.market.closesAt || a.market.title.localeCompare(b.market.title);
  });
}
