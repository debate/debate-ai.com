/**
 * @fileoverview Network call for the "LLM Card Scoring" AI assessment
 * (follow-up (a) under the "🧠 LLM Card Scoring" bullet in TODO.md). Kept
 * separate from `lib/llm-card-scoring-ai.ts`'s pure prompt-building and
 * response-parsing so those can be unit-tested without mocking the API
 * client.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `reason-editor`) rather than standing up a second route or a
 * dependency on the `reason-editor` package — via `debate-api-client`'s
 * `reasonAiComplete`, posting the same `{ system, messages, maxTokens }`
 * JSON contract that route accepts.
 *
 * @module lib/llm-card-scoring-client
 */

import { reasonAiComplete, type Client } from "debate-api-client";
import { apiClient } from "./api-client";
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
 * Requests an AI assessment for `card` from `/api/reason-ai`, returning the
 * parsed `CardScoringAiAssessment`.
 *
 * Throws a plain `Error` with a useful message when the request fails or
 * when the response text doesn't parse into a valid assessment.
 */
export async function requestCardScoringAiAssessment(
  card: CardScoringAiInput,
  client: Client = apiClient,
): Promise<CardScoringAiAssessment> {
  const { data, error } = await reasonAiComplete(
    {
      body: {
        system: CARD_SCORING_AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildCardScoringAiUserPrompt(card) }],
        maxTokens: MAX_TOKENS,
      },
    },
    { client },
  );

  if (error) {
    throw new Error("AI assessment request failed.");
  }

  const assessment = parseCardScoringAiResponse(data?.text ?? "");
  if (!assessment) {
    throw new Error("AI returned a response that couldn't be parsed as a card assessment.");
  }
  return assessment;
}
