/**
 * @fileoverview Network call for the "AI Practice Opponent" persona-
 * conditioned AI speech-generation follow-up (a) — see
 * `opponent-persona-speech-ai.ts`'s file doc-comment. Kept separate from
 * that pure prompt-building module so the prompt logic can be unit-tested
 * without mocking `fetch`, mirroring `ai-versus-speech-client.ts`'s split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by this package's plain Online Debate Versus AI speech-generation
 * call, `reason-editor`, and `debate-card-search`'s LLM Card Scoring AI
 * assessment) rather than standing up a second route — this is a small,
 * self-contained fetch-based client posting the same
 * `{ system, messages, maxTokens }` JSON contract that route accepts, with
 * only the `system` prompt swapped for a persona-conditioned one.
 *
 * @module round/opponent-persona-speech-client
 */

import type { OpponentPersona } from "debate-speech-writer/src/opponent/opponent-personas";
import { buildAiVersusSpeechUserPrompt, parseAiVersusSpeechResponse } from "./ai-versus-speech-ai";
import type { AiSpeechRequest } from "debate-round/src/round/ai-versus-speech-order";
import { buildPersonaAiVersusSystemPrompt } from "./opponent-persona-speech-ai";

/** A full speech can run several paragraphs, well beyond a short JSON verdict. */
const MAX_TOKENS = 2048;

/**
 * Requests the AI's next speech text for `request`, written in `persona`'s
 * style, from `/api/reason-ai` (or `endpoint`, if overridden), returning the
 * parsed speech text.
 *
 * Throws a plain `Error` with a useful message when the request fails
 * (reading `{ error }` from the response body if present — e.g. "Sign in
 * to use AI features." or "AI features are not configured on this
 * server." from the proxy's auth/config gates) or when the response text
 * parses to nothing usable.
 */
export async function requestAiVersusSpeechWithPersona(
  request: AiSpeechRequest,
  persona: OpponentPersona,
  endpoint = "/api/reason-ai",
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: buildPersonaAiVersusSystemPrompt(persona),
      messages: [{ role: "user", content: buildAiVersusSpeechUserPrompt(request) }],
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
    throw new Error(detail || `AI speech request failed (${res.status}).`);
  }

  const json = (await res.json()) as { text?: string };
  const speech = parseAiVersusSpeechResponse(json.text ?? "");
  if (!speech) {
    throw new Error("AI returned an empty or unusable speech.");
  }
  return speech;
}
