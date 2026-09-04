/**
 * @fileoverview Network call for the "LLM Card Scoring" AI assessment
 * (follow-up (a) under the "🧠 LLM Card Scoring" bullet in TODO.md). Kept
 * separate from `lib/llm-card-scoring-ai.ts`'s pure prompt-building and
 * response-parsing so those can be unit-tested without mocking `fetch`.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `reason-editor`) rather than standing up a second route or a
 * dependency on the `reason-editor` package — this is a small,
 * self-contained fetch-based client posting the same
 * `{ system, messages, maxTokens }` JSON contract that route accepts.
 *
 * @module lib/llm-card-scoring-client
 */

import {
  CARD_SCORING_AI_SYSTEM_PROMPT,
  buildCardScoringAiUserPrompt,
  parseCardScoringAiResponse,
  type CardScoringAiAssessment,
  type CardScoringAiInput,
} from "./llm-card-scoring-ai";

/** Small cap — the assessment reply is a short JSON object, not free-form prose. */
const MAX_TOKENS = 512;

/**
 * Requests an AI assessment for `card` from `/api/reason-ai` (or
 * `endpoint`, if overridden), returning the parsed
 * `CardScoringAiAssessment`.
 *
 * Throws a plain `Error` with a useful message when the request fails
 * (reading `{ error }` from the response body if present — e.g. "Sign in
 * to use AI features." or "AI features are not configured on this
 * server." from the proxy's auth/config gates) or when the response text
 * doesn't parse into a valid assessment.
 */
export async function requestCardScoringAiAssessment(
  card: CardScoringAiInput,
  endpoint = "/api/reason-ai",
): Promise<CardScoringAiAssessment> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: CARD_SCORING_AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildCardScoringAiUserPrompt(card) }],
      maxTokens: MAX_TOKENS,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const payload = (await res.json()) as { error?: string };
      detail = payload?.error ?? "";
    } catch {
      // Body wasn't JSON.
    }
    throw new Error(detail || `AI assessment request failed (${res.status}).`);
  }

  const json = (await res.json()) as { text?: string };
  const assessment = parseCardScoringAiResponse(json.text ?? "");
  if (!assessment) {
    throw new Error("AI returned a response that couldn't be parsed as a card assessment.");
  }
  return assessment;
}
