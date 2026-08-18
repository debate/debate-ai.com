/**
 * @fileoverview Pure prompt-building and response-parsing helpers for
 * follow-up (b) under idea #8 ("Video-Lecture-Training Coach AI") in
 * TODO.md: "an actual AI Q&A call that consumes `buildGroundedCoachPrompt`'s
 * output." `team-coach-materials.ts`'s `buildGroundedCoachPrompt` already
 * composes a self-contained user-turn prompt (the question plus the most
 * relevant grounding materials); this module adds the system prompt that
 * frames the model as the team's private coach and a tolerant parser for
 * its reply.
 *
 * This file makes no network call itself (see `team-coach-client.ts` for
 * that) so the response-parsing logic can be exercised directly in Vitest
 * without mocking `fetch`, mirroring `round/ai-versus-speech-ai.ts`'s split.
 *
 * @module coach/team-coach-ai
 */

/**
 * System prompt instructing the model to act as a team's private debate
 * coach AI and reply with the answer only — no preamble, no
 * meta-commentary about being an AI, no markdown code fences — so
 * `parseTeamCoachAiResponse` can use the reply directly. The grounding
 * materials and the instruction to stick to them live in the user-turn
 * prompt itself (`buildGroundedCoachPrompt`'s output), not here.
 */
export const TEAM_COACH_AI_SYSTEM_PROMPT =
  "You are a private debate coach AI for one team, speaking only from the grounding materials " +
  "(lecture transcripts, camp materials, instructional documents, practice-round recordings) the " +
  "user's message gives you. Explain concepts and give advice the way a coach would, grounded in " +
  "those materials. If the materials don't cover the question, say so plainly instead of guessing " +
  "or relying on general knowledge.\n\n" +
  "Reply with the answer text ONLY — no preamble like \"Here's my answer\", no meta-commentary " +
  "about being an AI, and no markdown code fences.";

/**
 * Tolerantly parses a model reply into answer text: trims surrounding
 * whitespace and strips a wrapping ```-fence (with an optional language
 * tag) if present, mirroring `round/ai-versus-speech-ai.ts`'s
 * `parseAiVersusSpeechResponse`. Returns `null` — rather than an empty
 * string — when nothing usable remains, so a blank AI reply degrades
 * gracefully instead of rendering an empty answer.
 */
export function parseTeamCoachAiResponse(raw: string): string | null {
  let text = raw.trim();
  if (!text) return null;

  const fenceMatch = text.match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/);
  if (fenceMatch) text = fenceMatch[1].trim();

  return text.length > 0 ? text : null;
}
