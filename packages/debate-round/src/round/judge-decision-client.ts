/**
 * @fileoverview Network call for the "AI Judge Decision Modes" AI
 * judge-decision follow-up (a) — see `judge-decision-ai.ts`'s file
 * doc-comment. Kept separate from that pure prompt-building/parsing module
 * so the prompt/parse logic can be unit-tested without mocking `fetch`,
 * mirroring `lib/llm-card-scoring-client.ts`'s split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `reason-editor`, `debate-card-search`'s LLM Card Scoring AI
 * assessment, and this package's Online Debate Versus AI speech-generation
 * call) rather than standing up a second route — this is a small,
 * self-contained fetch-based client posting the same
 * `{ system, messages, maxTokens }` JSON contract that route accepts.
 *
 * @module round/judge-decision-client
 */

import {
  JUDGE_DECISION_AI_SYSTEM_PROMPT,
  buildJudgeDecisionAiUserPrompt,
  parseJudgeDecisionAiResponse,
  type JudgeDecisionAiInput,
  type JudgeDecisionAiResult,
} from "./judge-decision-ai";

/** The reply is a short JSON verdict, not free-form prose. */
const MAX_TOKENS = 1024;

/**
 * Requests an AI judge decision for `input` from `/api/reason-ai` (or
 * `endpoint`, if overridden), returning the parsed
 * `JudgeDecisionAiResult`.
 *
 * Throws a plain `Error` with a useful message when the request fails
 * (reading `{ error }` from the response body if present — e.g. "Sign in
 * to use AI features." or "AI features are not configured on this
 * server." from the proxy's auth/config gates) or when the response text
 * doesn't parse into a valid decision.
 */
export async function requestJudgeDecision(
  input: JudgeDecisionAiInput,
  endpoint = "/api/reason-ai",
): Promise<JudgeDecisionAiResult> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: JUDGE_DECISION_AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildJudgeDecisionAiUserPrompt(input) }],
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
    throw new Error(detail || `AI judge decision request failed (${res.status}).`);
  }

  const json = (await res.json()) as { text?: string };
  const result = parseJudgeDecisionAiResponse(json.text ?? "");
  if (!result) {
    throw new Error("AI returned a response that couldn't be parsed as a judge decision.");
  }
  return result;
}
