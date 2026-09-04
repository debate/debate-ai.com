/**
 * @fileoverview Network call for the "AI Drill Generator" real-script
 * follow-up (b) — see `drill-script-ai.ts`'s file doc-comment. Kept separate
 * from that pure prompt/parse module so the response-parsing logic can be
 * unit-tested without mocking `fetch`, mirroring `coach-feedback-client.ts`'s
 * split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by this package's other AI speech/judge-decision/coach-feedback
 * calls) rather than standing up a second route — this is a small,
 * self-contained fetch-based client posting the same
 * `{ system, messages, maxTokens }` JSON contract that route accepts.
 *
 * @module round/drill-script-client
 */

import {
  DRILL_SCRIPT_AI_SYSTEM_PROMPT,
  buildDrillScriptAiUserPrompt,
  parseDrillScriptAiResponse,
  type DrillScriptAiInput,
} from "./drill-script-ai";

/** A single drill's script is a short rehearsal passage, not a full speech. */
const MAX_TOKENS = 1024;

/**
 * Requests an actual, ready-to-read AI practice script for `input`'s drill
 * from `/api/reason-ai` (or `endpoint`, if overridden), returning the
 * parsed script text.
 *
 * Throws a plain `Error` with a useful message when the request fails
 * (reading `{ error }` from the response body if present — e.g. "Sign in
 * to use AI features." or "AI features are not configured on this
 * server." from the proxy's auth/config gates) or when the response text
 * parses to nothing usable.
 */
export async function requestDrillScript(
  input: DrillScriptAiInput,
  endpoint = "/api/reason-ai",
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: DRILL_SCRIPT_AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildDrillScriptAiUserPrompt(input) }],
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
    throw new Error(detail || `Drill script AI request failed (${res.status}).`);
  }

  const json = (await res.json()) as { text?: string };
  const script = parseDrillScriptAiResponse(json.text ?? "");
  if (!script) {
    throw new Error("AI returned an empty or unusable drill script response.");
  }
  return script;
}
