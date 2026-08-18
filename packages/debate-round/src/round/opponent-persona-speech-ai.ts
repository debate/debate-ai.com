/**
 * @fileoverview Pure prompt-building for follow-up (a) under the "🤖 AI
 * Practice Opponent" idea in TODO.md: "an actual AI speech-generation call
 * that consumes `buildOpponentPersonaPrompt`'s output alongside idea #3's
 * `AiSpeechRequest`". `debate-speech-writer`'s `opponent/opponent-personas.ts`
 * already turns a selected `OpponentPersona` into a self-contained prompt
 * section (`buildOpponentPersonaPrompt`); this module composes that with the
 * existing "Online Debate Versus AI" speech-generation system prompt
 * (`ai-versus-speech-ai.ts`'s `AI_VERSUS_SPEECH_SYSTEM_PROMPT`) so the AI
 * opponent argues in the practice session's selected style instead of a
 * generic one.
 *
 * Reuses `ai-versus-speech-ai.ts`'s `buildAiVersusSpeechUserPrompt` and
 * `parseAiVersusSpeechResponse` unchanged — only the system prompt changes
 * once a persona is selected, and the request/response shape stays exactly
 * the `AiSpeechRequest`/speech-text contract idea #3 already established —
 * so no new user-prompt or response-parsing logic is introduced here.
 *
 * This file makes no network call itself (see
 * `opponent-persona-speech-client.ts` for that) so the prompt-building logic
 * can be exercised directly in Vitest without mocking `fetch`, mirroring
 * `ai-versus-speech-ai.ts`'s own split.
 *
 * @module round/opponent-persona-speech-ai
 */

import { buildOpponentPersonaPrompt, type OpponentPersona } from "debate-speech-writer/src/opponent/opponent-personas";
import { AI_VERSUS_SPEECH_SYSTEM_PROMPT } from "./ai-versus-speech-ai";

/**
 * Builds the system prompt for a persona-conditioned AI-versus speech
 * request: the existing `AI_VERSUS_SPEECH_SYSTEM_PROMPT` instructions,
 * followed by `buildOpponentPersonaPrompt`'s persona-specific
 * description/preferred-arguments/pace/instructions section, with an
 * explicit note that the persona's style takes priority over the generic
 * instructions above it.
 */
export function buildPersonaAiVersusSystemPrompt(persona: OpponentPersona): string {
  return (
    `${AI_VERSUS_SPEECH_SYSTEM_PROMPT}\n\n` +
    "Argue in the following persona's style — let it override the general tone above wherever " +
    "they conflict, while still writing only the speech text itself:\n\n" +
    buildOpponentPersonaPrompt(persona)
  );
}
