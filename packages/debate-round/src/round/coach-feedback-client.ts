/**
 * @fileoverview Network call for the "AI Coach Mode" open-ended-feedback
 * follow-up (a) — see `coach-feedback-ai.ts`'s file doc-comment. Kept
 * separate from that pure prompt/parse module so the response-parsing
 * logic can be unit-tested without mocking `fetch`, mirroring
 * `debate-speech-writer`'s `coach/team-coach-client.ts` split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `reason-editor`, `debate-card-search`'s LLM Card Scoring AI
 * assessment, and this package's other AI speech/judge-decision calls)
 * rather than standing up a second route — this is a small, self-contained
 * fetch-based client posting the same `{ system, messages, maxTokens }`
 * JSON contract that route accepts.
 *
 * @module round/coach-feedback-client
 */

import {
  COACH_FEEDBACK_AI_SYSTEM_PROMPT,
  buildCoachFeedbackAiUserPrompt,
  parseCoachFeedbackAiResponse,
  type CoachFeedbackAiInput,
} from "./coach-feedback-ai";

/** Open-ended coaching feedback can run several paragraphs, well beyond a short JSON verdict. */
const MAX_TOKENS = 2048;

/**
 * Requests open-ended AI coaching feedback for `input` from
 * `/api/reason-ai` (or `endpoint`, if overridden), returning the parsed
 * feedback text.
 *
 * Throws a plain `Error` with a useful message when the request fails
 * (reading `{ error }` from the response body if present — e.g. "Sign in
 * to use AI features." or "AI features are not configured on this
 * server." from the proxy's auth/config gates) or when the response text
 * parses to nothing usable.
 */
export async function requestCoachFeedback(
  input: CoachFeedbackAiInput,
  endpoint = "/api/reason-ai",
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: COACH_FEEDBACK_AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildCoachFeedbackAiUserPrompt(input) }],
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
    throw new Error(detail || `Coach feedback AI request failed (${res.status}).`);
  }

  const json = (await res.json()) as { text?: string };
  const feedback = parseCoachFeedbackAiResponse(json.text ?? "");
  if (!feedback) {
    throw new Error("AI returned an empty or unusable feedback response.");
  }
  return feedback;
}
