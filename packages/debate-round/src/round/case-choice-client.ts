/**
 * @fileoverview Network call for the "Scout-to-Strategy Workflow" AI
 * case-choice follow-up (c) — see `case-choice-ai.ts`'s file doc-comment.
 * Kept separate from that pure prompt-building/parsing module so the
 * prompt/parse logic can be unit-tested without mocking `fetch`, mirroring
 * `judge-decision-client.ts`'s split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by this package's AI judge-decision and drill-script calls) rather
 * than standing up a second route — this is a small, self-contained
 * fetch-based client posting the same `{ system, messages, maxTokens }`
 * JSON contract that route accepts.
 *
 * @module round/case-choice-client
 */

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
 * Requests an AI case-choice evaluation for `input` from `/api/reason-ai`
 * (or `endpoint`, if overridden), returning the parsed `CaseChoiceAiResult`.
 *
 * Throws a plain `Error` with a useful message when the request fails
 * (reading `{ error }` from the response body if present — e.g. "Sign in
 * to use AI features." or "AI features are not configured on this
 * server." from the proxy's auth/config gates) or when the response text
 * doesn't parse into a valid evaluation.
 */
export async function requestCaseChoiceEvaluation(
  input: CaseChoiceAiInput,
  endpoint = "/api/reason-ai",
): Promise<CaseChoiceAiResult> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: CASE_CHOICE_AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildCaseChoiceAiUserPrompt(input) }],
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
    throw new Error(detail || `AI case-choice evaluation request failed (${res.status}).`);
  }

  const json = (await res.json()) as { text?: string };
  const result = parseCaseChoiceAiResponse(json.text ?? "");
  if (!result) {
    throw new Error("AI returned a response that couldn't be parsed as a case-choice evaluation.");
  }
  return result;
}
