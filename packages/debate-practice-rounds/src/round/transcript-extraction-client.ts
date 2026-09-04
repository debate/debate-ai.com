/**
 * @fileoverview Network call for the "Speech Transcript Summaries and
 * Answers" raw-transcript-extraction follow-up — see
 * `transcript-extraction-ai.ts`'s file doc-comment. Kept separate from that
 * pure prompt/parse module so the response-parsing logic can be
 * unit-tested without mocking `fetch`, mirroring `coach-feedback-client.ts`'s
 * split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `reason-editor`, `debate-card-search`'s LLM Card Scoring AI
 * assessment, and this package's other AI speech/judge-decision calls)
 * rather than standing up a second route — this is a small, self-contained
 * fetch-based client posting the same `{ system, messages, maxTokens }`
 * JSON contract that route accepts.
 *
 * @module round/transcript-extraction-client
 */

import {
  TRANSCRIPT_EXTRACTION_AI_SYSTEM_PROMPT,
  buildTranscriptExtractionAiUserPrompt,
  parseTranscriptExtractionAiResponse,
  type ExtractedArgument,
  type TranscriptExtractionAiInput,
} from "./transcript-extraction-ai";

/** A transcript can contain many arguments; leave room for a full extracted list. */
const MAX_TOKENS = 2048;

/**
 * Requests AI extraction of `input`'s raw speech transcript into
 * `ExtractedArgument[]` from `/api/reason-ai` (or `endpoint`, if
 * overridden).
 *
 * Throws a plain `Error` with a useful message when the request fails
 * (reading `{ error }` from the response body if present — e.g. "Sign in
 * to use AI features." or "AI features are not configured on this
 * server." from the proxy's auth/config gates) or when the response text
 * parses to no usable arguments.
 */
export async function requestTranscriptExtraction(
  input: TranscriptExtractionAiInput,
  endpoint = "/api/reason-ai",
): Promise<ExtractedArgument[]> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: TRANSCRIPT_EXTRACTION_AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildTranscriptExtractionAiUserPrompt(input) }],
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
    throw new Error(detail || `Transcript extraction AI request failed (${res.status}).`);
  }

  const json = (await res.json()) as { text?: string };
  const extracted = parseTranscriptExtractionAiResponse(json.text ?? "");
  if (!extracted) {
    throw new Error("AI returned no usable extracted arguments.");
  }
  return extracted;
}
