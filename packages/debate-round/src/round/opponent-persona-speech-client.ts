/**
 * @fileoverview Network call for the "AI Practice Opponent" persona-
 * conditioned AI speech-generation follow-up (a) — see
 * `opponent-persona-speech-ai.ts`'s file doc-comment. Kept separate from
 * that pure prompt-building module so the prompt logic can be unit-tested
 * without mocking the API client, mirroring `ai-versus-speech-client.ts`'s
 * split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by this package's plain Online Debate Versus AI speech-generation
 * call, `reason-editor`, and `debate-card-search`'s LLM Card Scoring AI
 * assessment) rather than standing up a second route — via
 * `debate-api-client`'s `reasonAiComplete`, posting the same
 * `{ system, messages, maxTokens }` JSON contract that route accepts, with
 * only the `system` prompt swapped for a persona-conditioned one.
 *
 * @module round/opponent-persona-speech-client
 */

import { reasonAiComplete, type Client } from "debate-api-client";
import { apiClient } from "../lib/api-client";
import type { OpponentPersona } from "debate-speech-writer/src/opponent/opponent-personas";
import { buildAiVersusSpeechUserPrompt, parseAiVersusSpeechResponse } from "./ai-versus-speech-ai";
import type { AiSpeechRequest } from "./ai-versus-speech-order";
import { buildPersonaAiVersusSystemPrompt } from "./opponent-persona-speech-ai";

/** A full speech can run several paragraphs, well beyond a short JSON verdict. */
const MAX_TOKENS = 2048;

/**
 * Requests the AI's next speech text for `request`, written in `persona`'s
 * style, from `/api/reason-ai`, returning the parsed speech text.
 *
 * Throws a plain `Error` with a useful message when the request fails or
 * when the response text parses to nothing usable.
 */
export async function requestAiVersusSpeechWithPersona(
  request: AiSpeechRequest,
  persona: OpponentPersona,
  client: Client = apiClient,
): Promise<string> {
  const { data, error } = await reasonAiComplete(
    {
      body: {
        system: buildPersonaAiVersusSystemPrompt(persona),
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
