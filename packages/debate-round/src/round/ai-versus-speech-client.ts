/**
 * @fileoverview Network call for "Online Debate Versus AI"'s AI
 * speech-generation follow-up (a) — see `ai-versus-speech-ai.ts`'s file
 * doc-comment. Kept separate from that pure prompt-building/parsing module
 * so the prompt/parse logic can be unit-tested without mocking `fetch`,
 * mirroring `lib/llm-card-scoring-client.ts`'s split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `reason-editor` and `debate-card-search`'s LLM Card Scoring AI
 * assessment) rather than standing up a second route — this is a small,
 * self-contained fetch-based client posting the same
 * `{ system, messages, maxTokens }` JSON contract that route accepts.
 *
 * @module round/ai-versus-speech-client
 */

import {
  AI_VERSUS_SPEECH_SYSTEM_PROMPT,
  buildAiVersusSpeechUserPrompt,
  parseAiVersusSpeechResponse,
} from "./ai-versus-speech-ai";
import type { AiSpeechRequest } from "./ai-versus-speech-order";

/** A full speech can run several paragraphs, well beyond a short JSON verdict. */
const MAX_TOKENS = 2048;

/**
 * Requests the AI's next speech text for `request` from `/api/reason-ai`
 * (or `endpoint`, if overridden), returning the parsed speech text.
 *
 * Throws a plain `Error` with a useful message when the request fails
 * (reading `{ error }` from the response body if present — e.g. "Sign in
 * to use AI features." or "AI features are not configured on this
 * server." from the proxy's auth/config gates) or when the response text
 * parses to nothing usable.
 */
export async function requestAiVersusSpeech(
  request: AiSpeechRequest,
  endpoint = "/api/reason-ai",
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: AI_VERSUS_SPEECH_SYSTEM_PROMPT,
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
