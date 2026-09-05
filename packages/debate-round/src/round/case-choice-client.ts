/**
 * @fileoverview Network call for the "Scout-to-Strategy Workflow" AI
 * case-choice follow-up (c) — see `case-choice-ai.ts`'s file doc-comment.
 * Kept separate from that pure prompt-building/parsing module so the
 * prompt/parse logic can be unit-tested without mocking the API client,
 * mirroring `judge-decision-client.ts`'s split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by this package's AI judge-decision and drill-script calls) rather
 * than standing up a second route — via `debate-api-client`'s
 * `reasonAiComplete`, posting the same `{ system, messages, maxTokens }`
 * JSON contract that route accepts.
 *
 * @module round/case-choice-client
 */

import { reasonAiComplete, type Client } from "debate-api-client";
import { apiClient } from "../lib/api-client";
import {
  CASE_CHOICE_AI_SYSTEM_PROMPT,
  buildCaseChoiceAiUserPrompt,
  parseCaseChoiceAiResponse,
  type CaseChoiceAiInput,
  type CaseChoiceAiResult,
} from "./case-choice-ai";

/** The reply is a short JSON verdict, not free-form prose. */
const MAX_TOKENS = 1024;

/**
 * Requests an AI case-choice evaluation for `input` from `/api/reason-ai`,
 * returning the parsed `CaseChoiceAiResult`.
 *
 * Throws a plain `Error` with a useful message when the request fails or
 * when the response text doesn't parse into a valid evaluation.
 */
export async function requestCaseChoiceEvaluation(
  input: CaseChoiceAiInput,
  client: Client = apiClient,
): Promise<CaseChoiceAiResult> {
  const { data, error } = await reasonAiComplete(
    {
      body: {
        system: CASE_CHOICE_AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildCaseChoiceAiUserPrompt(input) }],
        maxTokens: MAX_TOKENS,
      },
    },
    { client },
  );

  if (error) {
    throw new Error("AI case-choice evaluation request failed.");
  }

  const result = parseCaseChoiceAiResponse(data?.text ?? "");
  if (!result) {
    throw new Error("AI returned a response that couldn't be parsed as a case-choice evaluation.");
  }
  return result;
}
