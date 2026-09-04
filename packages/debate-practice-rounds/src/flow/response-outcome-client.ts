/**
 * @fileoverview Network call for the "AI Response-Outcome Charts" AI
 * counsel-panel follow-up (a) — see `response-outcome-ai.ts`'s file
 * doc-comment. Kept separate from that pure prompt-building/parsing module
 * so the prompt/parse logic can be unit-tested without mocking `fetch`,
 * mirroring `round/judge-decision-client.ts`'s split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `reason-editor`, `debate-card-search`'s LLM Card Scoring AI
 * assessment, and this package's other AI-backed calls) rather than
 * standing up a second route — this is a small, self-contained
 * fetch-based client posting the same `{ system, messages, maxTokens }`
 * JSON contract that route accepts.
 *
 * @module flow/response-outcome-client
 */

import {
  COUNSEL_PANEL_AI_SYSTEM_PROMPT,
  buildCounselPanelAiUserPrompt,
  parseCounselPanelAiResponse,
  type CounselPanelAiInput,
  type CounselPanelAiResult,
} from "./response-outcome-ai";

/** The reply is a short JSON verdict per argument, not free-form prose. */
const MAX_TOKENS = 1536;

/**
 * Requests an AI counsel-panel assessment for `input` from `/api/reason-ai`
 * (or `endpoint`, if overridden), returning the parsed
 * `CounselPanelAiResult`.
 *
 * Throws a plain `Error` with a useful message when the request fails
 * (reading `{ error }` from the response body if present — e.g. "Sign in
 * to use AI features." or "AI features are not configured on this
 * server." from the proxy's auth/config gates) or when the response text
 * doesn't parse into a valid assessment.
 */
export async function requestCounselPanelAssessment(
  input: CounselPanelAiInput,
  endpoint = "/api/reason-ai",
): Promise<CounselPanelAiResult> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: COUNSEL_PANEL_AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildCounselPanelAiUserPrompt(input) }],
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
    throw new Error(detail || `AI counsel-panel request failed (${res.status}).`);
  }

  const json = (await res.json()) as { text?: string };
  const result = parseCounselPanelAiResponse(json.text ?? "");
  if (!result) {
    throw new Error("AI returned a response that couldn't be parsed as a counsel-panel assessment.");
  }
  return result;
}
