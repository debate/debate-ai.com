/**
 * @fileoverview Suggests which saved flow belongs to a round being logged, so
 * the Log-a-round form can offer a one-click link without the user hunting
 * through the picker. Saved flows carry no round id, so the match is by label:
 * a flow qualifies when its label contains the tournament name.
 */

import type { SavedFlowSummary } from "../state/savedFlows";

/** Names shorter than this match too much to be a useful signal. */
const MIN_TOURNAMENT_NAME_LENGTH = 3;

/**
 * The single saved flow whose label mentions `tournamentName` (case-insensitive),
 * or `null` when none or several do. Ambiguity returns `null` rather than
 * guessing, so a wrong flow is never suggested.
 */
export function suggestFlowForRound(
  flows: readonly Pick<SavedFlowSummary, "clientId" | "label">[],
  tournamentName: string,
): Pick<SavedFlowSummary, "clientId" | "label"> | null {
  const needle = tournamentName.trim().toLowerCase();
  if (needle.length < MIN_TOURNAMENT_NAME_LENGTH) return null;
  const matches = flows.filter((f) => f.label.toLowerCase().includes(needle));
  return matches.length === 1 ? matches[0] : null;
}
