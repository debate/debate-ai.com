/**
 * @fileoverview Resolves a round's persisted "AI Practice Opponent" persona
 * selection into the prompt section `round/ai-versus-speech-ai.ts`'s
 * `buildAiVersusSpeechUserPrompt` accepts — closing the "AI Practice
 * Opponent" idea's follow-up (a) in TODO.md's Product Feature Ideas list:
 * "an actual AI speech-generation call that consumes
 * `buildOpponentPersonaPrompt`'s output alongside idea #3's
 * `AiSpeechRequest`".
 *
 * `debate-speech-writer`'s `state/opponentPersonaSelections.ts` persists a
 * selection keyed by a freeform `sessionId`, independent of this package's
 * `roundId`-keyed `state/aiVersusRounds.ts`. Rather than adding a
 * cross-store id or a persona field to `AiVersusRoundRecord`, this module
 * follows the "Pre-Round Briefing Store Wiring" convention
 * (`round/pre-round-briefing.ts`) of composing two already-persisted stores
 * by a shared key — here, treating a round's `roundId` as its
 * `sessionId` — so picking a persona at `/practice-opponent` with the same
 * id used to start a round at `/versus-ai` is enough to apply it; no
 * persona selected for that id simply means the persona-neutral prompt.
 *
 * @module round/ai-versus-persona-wiring
 */

import { buildOpponentPersonaPrompt, type OpponentPersona } from "debate-speech-writer/src/opponent/opponent-personas";
import { getOpponentPersonaSelection } from "debate-speech-writer/src/state/opponentPersonaSelections";

/**
 * Looks up the persisted `OpponentPersona` selected for `roundId` (via its
 * shared-key `sessionId`), or `null` if none is selected.
 */
export function resolveAiVersusOpponentPersona(roundId: string): OpponentPersona | null {
  return getOpponentPersonaSelection(roundId)?.persona ?? null;
}

/**
 * Builds the persona prompt section for `roundId`, ready to pass as
 * `requestAiVersusSpeech`'s `personaPromptSection` option — or `null` if no
 * persona is selected for this round, in which case the caller should omit
 * the option entirely rather than pass `null` through.
 */
export function buildAiVersusPersonaPromptSection(roundId: string): string | null {
  const persona = resolveAiVersusOpponentPersona(roundId);
  return persona ? buildOpponentPersonaPrompt(persona) : null;
}
