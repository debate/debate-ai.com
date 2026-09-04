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
 * `getOpponentDifficultyForRound` closes the same store's `difficulty` field
 * out to the same key — the "a difficulty slider layered on top of persona
 * choice" Next item named under the "🤖 AI Practice Opponent" idea in
 * TODO.md. It always resolves to a concrete `OpponentDifficulty` (falling
 * back to `DEFAULT_OPPONENT_DIFFICULTY` when no selection is saved, or a
 * saved selection predates this field), so a caller never has to handle a
 * missing difficulty itself.
 *
 * @module round/opponent-persona-speech-wiring
 */

import { getOpponentPersonaSelection } from "../state/opponentPersonaSelections";
import {
  DEFAULT_OPPONENT_DIFFICULTY,
  type OpponentDifficulty,
  type OpponentPersona,
} from "debate-speech-writer/src/opponent/opponent-personas";

/**
 * Looks up the persisted `OpponentPersona` saved for `roundId` (via the
 * Opponent Persona Picker panel, under that same identifier as its
 * `sessionId`), or `null` if none is saved for it.
 */
export function getOpponentPersonaForRound(roundId: string): OpponentPersona | null {
  return getOpponentPersonaSelection(roundId)?.persona ?? null;
}

/**
 * Looks up the persisted `OpponentDifficulty` saved for `roundId` under the
 * same key as `getOpponentPersonaForRound`, defaulting to
 * `DEFAULT_OPPONENT_DIFFICULTY` when no selection (or no difficulty on an
 * existing selection) is saved for it.
 */
export function getOpponentDifficultyForRound(roundId: string): OpponentDifficulty {
  return getOpponentPersonaSelection(roundId)?.difficulty ?? DEFAULT_OPPONENT_DIFFICULTY;
}
