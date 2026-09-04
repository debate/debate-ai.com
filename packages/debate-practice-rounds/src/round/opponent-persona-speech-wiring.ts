/**
 * @fileoverview Resolves an "Online Debate Versus AI" round's chosen AI
 * opponent persona directly from the already-persisted
 * `opponentPersonaSelections.ts` store instead of requiring a caller to
 * supply it — the "Pre-Round Briefing Store Wiring" convention
 * (`pre-round-briefing.ts`'s `buildPreRoundBriefingFromStores`) applied to
 * the "AI Practice Opponent" idea's follow-up (a).
 *
 * `opponentPersonaSelections.ts` keys a saved selection by `sessionId`
 * (a free-text identifier for a practice session, chosen in the Opponent
 * Persona Picker panel) and `aiVersusRounds.ts` keys a saved round by
 * `roundId` (also a free-text identifier, chosen in the Online Debate Versus
 * AI panel). Both are caller-typed identifiers for the same conceptual
 * practice session, so this module treats them as the same key rather than
 * introducing a new persistence field to link them.
 *
 * @module round/opponent-persona-speech-wiring
 */

import { getOpponentPersonaSelection } from "../state/opponentPersonaSelections";
import type { OpponentPersona } from "debate-speech-writer/src/opponent/opponent-personas";

/**
 * Looks up the persisted `OpponentPersona` saved for `roundId` (via the
 * Opponent Persona Picker panel, under that same identifier as its
 * `sessionId`), or `null` if none is saved for it.
 */
export function getOpponentPersonaForRound(roundId: string): OpponentPersona | null {
  return getOpponentPersonaSelection(roundId)?.persona ?? null;
}
