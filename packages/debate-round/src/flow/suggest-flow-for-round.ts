/**
 * @fileoverview Suggests which saved flow a logged round most likely came from,
 * so the Log-a-round form can offer a one-click link instead of a manual pick.
 *
 * Saved flows only carry a free-text label, so matching is by label text: a
 * flow is a candidate when its label mentions the tournament name, and ranks
 * higher when it also mentions the division or round id.
 */

import type { SavedFlowSummary } from "../state/savedFlows";

export type RoundFlowQuery = {
  tournamentName: string;
  division?: string;
  roundId?: string;
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Saved flows whose label mentions the round's tournament, best match first.
 * Ties break to the most recently updated flow. Returns `[]` when the
 * tournament name is blank, so an unfilled form never suggests anything.
 */
export function suggestFlowsForRound(
  flows: readonly SavedFlowSummary[],
  query: RoundFlowQuery,
): SavedFlowSummary[] {
  const tournament = normalize(query.tournamentName);
  if (tournament === "") return [];
  const division = normalize(query.division ?? "");
  const roundId = normalize(query.roundId ?? "");

  return flows
    .map((flow) => {
      const label = normalize(flow.label);
      if (!label.includes(tournament)) return null;
      const score =
        1 + (division !== "" && label.includes(division) ? 1 : 0) + (roundId !== "" && label.includes(roundId) ? 1 : 0);
      return { flow, score };
    })
    .filter((entry): entry is { flow: SavedFlowSummary; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score || b.flow.updatedAt.localeCompare(a.flow.updatedAt))
    .map((entry) => entry.flow);
}
