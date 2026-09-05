/**
 * @fileoverview Network call for the "Speech Transcript Summaries and
 * Answers" raw-transcript-extraction follow-up — see
 * `transcript-extraction-ai.ts`'s file doc-comment. Kept separate from that
 * pure prompt/parse module so the response-parsing logic can be
 * unit-tested without mocking the API client, mirroring
 * `coach-feedback-client.ts`'s split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `reason-editor`, `debate-card-search`'s LLM Card Scoring AI
 * assessment, and this package's other AI speech/judge-decision calls)
 * rather than standing up a second route — via `debate-api-client`'s
 * `reasonAiComplete`, posting the same `{ system, messages, maxTokens }`
 * JSON contract that route accepts.
 *
 * @module round/transcript-extraction-client
 */

import { reasonAiComplete, type Client } from "debate-api-client";
import { apiClient } from "../lib/api-client";
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
 * `ExtractedArgument[]` from `/api/reason-ai`.
 *
 * Throws a plain `Error` with a useful message when the request fails or
 * when the response text parses to no usable arguments.
 */
export async function requestTranscriptExtraction(
  input: TranscriptExtractionAiInput,
  client: Client = apiClient,
): Promise<ExtractedArgument[]> {
  const { data, error } = await reasonAiComplete(
    {
      body: {
        system: TRANSCRIPT_EXTRACTION_AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildTranscriptExtractionAiUserPrompt(input) }],
        maxTokens: MAX_TOKENS,
      },
    },
    { client },
  );

  if (error) {
    throw new Error("Transcript extraction AI request failed.");
  }

  const extracted = parseTranscriptExtractionAiResponse(data?.text ?? "");
  if (!extracted) {
    throw new Error("AI returned no usable extracted arguments.");
  }
  return extracted;
}
