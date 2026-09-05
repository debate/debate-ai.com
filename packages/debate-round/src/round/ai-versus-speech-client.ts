/**
 * @fileoverview Network call for "Online Debate Versus AI"'s AI
 * speech-generation follow-up (a) — see `ai-versus-speech-ai.ts`'s file
 * doc-comment. Kept separate from that pure prompt-building/parsing module
 * so the prompt/parse logic can be unit-tested without mocking the API
 * client, mirroring `lib/llm-card-scoring-client.ts`'s split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `reason-editor` and `debate-card-search`'s LLM Card Scoring AI
 * assessment) rather than standing up a second route — via
 * `debate-api-client`'s `reasonAiComplete`, posting the same
 * `{ system, messages, maxTokens }` JSON contract that route accepts.
 *
 * @module round/ai-versus-speech-client
 */

import { reasonAiComplete, type Client } from "debate-api-client";
import { apiClient } from "../lib/api-client";
import {
  AI_VERSUS_SPEECH_SYSTEM_PROMPT,
  buildAiVersusSpeechUserPrompt,
  parseAiVersusSpeechResponse,
} from "./ai-versus-speech-ai";
import type { AiSpeechRequest } from "./ai-versus-speech-order";

/** A full speech can run several paragraphs, well beyond a short JSON verdict. */
const MAX_TOKENS = 2048;

/**
 * Requests the AI's next speech text for `request` from `/api/reason-ai`,
 * returning the parsed speech text.
 *
 * Throws a plain `Error` with a useful message when the request fails or
 * when the response text parses to nothing usable.
 */
export async function requestAiVersusSpeech(request: AiSpeechRequest, client: Client = apiClient): Promise<string> {
  const { data, error } = await reasonAiComplete(
    {
      body: {
        system: AI_VERSUS_SPEECH_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildAiVersusSpeechUserPrompt(request) }],
        maxTokens: MAX_TOKENS,
      },
    },
    { client },
  );

  if (error) {
    throw new Error("AI speech request failed.");
  }

  const speech = parseAiVersusSpeechResponse(data?.text ?? "");
  if (!speech) {
    throw new Error("AI returned an empty or unusable speech.");
  }
  return speech;
}
