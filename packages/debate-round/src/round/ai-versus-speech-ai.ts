/**
 * @fileoverview Pure prompt-building and response-parsing helpers for
 * follow-up (a) under idea #3 ("Online Debate Versus AI") in TODO.md: "an
 * actual AI speech-generation call that consumes `buildAiResponseRequest`'s
 * output (prior speeches + slot + cross-ex flag) to produce the AI's next
 * speech text". `ai-versus-speech-order.ts`'s `buildAiResponseRequest`
 * already derives the structured `AiSpeechRequest` this module turns into a
 * prompt; this file adds the prompt/response layer on top of it without
 * changing that turn-order logic.
 *
 * This file makes no network call itself (see
 * `ai-versus-speech-client.ts` for that) so the prompt-building and
 * parsing logic can be exercised directly in Vitest without mocking
 * `fetch`, mirroring `lib/llm-card-scoring-ai.ts`'s split.
 *
 * Also closes the "AI Practice Opponent" idea's follow-up (a) — "an actual
 * AI speech-generation call that consumes `buildOpponentPersonaPrompt`'s
 * output alongside idea #3's `AiSpeechRequest`" — via
 * `buildAiVersusSpeechUserPrompt`'s optional `personaPromptSection`
 * parameter; see `round/ai-versus-persona-wiring.ts` for how a round's
 * persisted persona selection is resolved into that section.
 *
 * @module round/ai-versus-speech-ai
 */

import type { AiSpeechRequest, PriorSpeechRecord } from "./ai-versus-speech-order";

/**
 * System prompt instructing the model to act as the AI side of a practice
 * debate round and reply with the speech text only — no preamble, no
 * meta-commentary about being an AI, no markdown code fences — so
 * `parseAiVersusSpeechResponse` can use the reply directly.
 */
export const AI_VERSUS_SPEECH_SYSTEM_PROMPT =
  "You are a skilled competitive debater practicing against a human opponent. You will be told " +
  "which speech you're delivering next (and its time limit), whether it's a cross-examination " +
  "turn, and every speech delivered so far in the round. Write only the speech itself, as you " +
  "would actually deliver it in round — clear taglines, structured argumentation, and direct " +
  "engagement with prior speeches where relevant.\n\n" +
  "Reply with the speech text ONLY — no preamble like \"Here's my speech\", no meta-commentary " +
  "about being an AI, no markdown formatting or code fences, and no explanation of your " +
  "choices afterward.";

function formatPriorSpeeches(priorSpeeches: PriorSpeechRecord[]): string {
  if (priorSpeeches.length === 0) return "(none yet — you are speaking first)";
  return priorSpeeches
    .map((speech) => `--- ${speech.name} (${speech.speaker === "user" ? "opponent" : "you"}) ---\n${speech.text}`)
    .join("\n\n");
}

/**
 * Builds the user-turn message text for an AI-versus speech-generation
 * request: which slot is being delivered, its time limit, whether it's a
 * cross-examination turn, and every prior speech in delivery order (tagged
 * "you" for the AI's own earlier speeches and "opponent" for the human
 * user's), so the model can respond to what's actually been said.
 *
 * `personaPromptSection`, if supplied, is prepended verbatim ahead of the
 * turn details — the "AI Practice Opponent" idea's
 * `buildOpponentPersonaPrompt(persona)` output, so the generated speech
 * argues in that persona's preferred style (see
 * `round/ai-versus-persona-wiring.ts`). Omitting it preserves the prior,
 * persona-neutral prompt exactly.
 */
export function buildAiVersusSpeechUserPrompt(
  request: AiSpeechRequest,
  personaPromptSection?: string,
): string {
  const { slot, priorSpeeches, isCrossExamination } = request;

  const personaBlock = personaPromptSection ? `${personaPromptSection}\n\n` : "";

  return (
    personaBlock +
    `You are delivering "${slot.name}"${isCrossExamination ? " (a cross-examination turn)" : ""}, ` +
    `with a time limit of ${slot.time} seconds.\n\n` +
    "Speeches delivered so far, in order:\n" +
    `${formatPriorSpeeches(priorSpeeches)}\n\n` +
    `Write the "${slot.name}" now. Reply with the speech text only.`
  );
}

/**
 * Tolerantly parses a model reply into speech text: trims surrounding
 * whitespace, strips a wrapping ```-fence (with an optional language tag)
 * if present, and strips a single layer of wrapping double quotes some
 * models add. Returns `null` — rather than an empty string — when nothing
 * usable remains, so a blank AI reply degrades gracefully instead of
 * saving an empty speech.
 */
export function parseAiVersusSpeechResponse(raw: string): string | null {
  let text = raw.trim();
  if (!text) return null;

  const fenceMatch = text.match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/);
  if (fenceMatch) text = fenceMatch[1].trim();

  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1).trim();
  }

  return text.length > 0 ? text : null;
}
