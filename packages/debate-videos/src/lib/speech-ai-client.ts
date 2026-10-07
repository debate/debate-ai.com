/**
 * @fileoverview The network half of the watch page's two transcript AI
 * buttons — "Detect speeches" (`speech-segmentation.ts`) and a speech's
 * "AI summary" (`speech-summary.ts`).
 *
 * Both post to the app's shared `/api/reason-ai` proxy, the same
 * `{ system, messages, maxTokens }` contract the Outcomes simulator uses.
 * The proxy picks the model: the site's shared OpenRouter or Anthropic key,
 * or the user's own key when they saved one (the app attaches it to these
 * requests itself). It requires a signed-in session; its `{ error }` message
 * ("Sign in to use AI features.") is surfaced as-is.
 * @module lib/speech-ai-client
 */

import {
  SPEECH_SEGMENTATION_SYSTEM_PROMPT,
  buildSpeechSegmentationPrompt,
  parseSpeechSegmentationResponse,
  type SpeechSegmentation,
  type SpeechSegmentationInput,
} from "./speech-segmentation";
import {
  SPEECH_SUMMARY_SYSTEM_PROMPT,
  buildSpeechSummaryPrompt,
  parseSpeechSummaryResponse,
  type SpeechSummaryInput,
} from "./speech-summary";

export interface SpeechAiRequestOptions {
  endpoint?: string;
  signal?: AbortSignal;
}

async function askReasonAi(
  body: { system: string; prompt: string; maxTokens: number; temperature: number },
  { endpoint = "/api/reason-ai", signal }: SpeechAiRequestOptions,
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: body.system,
      messages: [{ role: "user", content: body.prompt }],
      maxTokens: body.maxTokens,
      temperature: body.temperature,
    }),
    signal,
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: string })?.error ?? "";
    } catch {
      // Body wasn't JSON.
    }
    throw new Error(detail || `The AI request failed (${res.status}).`);
  }

  return ((await res.json()) as { text?: string }).text ?? "";
}

/**
 * Asks the model where each speech of a round begins and ends.
 *
 * @throws An `Error` carrying the proxy's message when the request fails, or
 *   when the reply names no speech.
 */
export async function requestSpeechSegmentation(
  input: SpeechSegmentationInput,
  options: SpeechAiRequestOptions = {},
): Promise<SpeechSegmentation> {
  const text = await askReasonAi(
    {
      system: SPEECH_SEGMENTATION_SYSTEM_PROMPT,
      prompt: buildSpeechSegmentationPrompt(input),
      maxTokens: 2000,
      temperature: 0,
    },
    options,
  );
  const segmentation = parseSpeechSegmentationResponse(text);
  if (!segmentation) throw new Error("The AI couldn't find any speeches in these captions. Try again, or mark them by hand.");
  return segmentation;
}

/**
 * Asks the model for one speech's key points and warrants as a bullet outline.
 *
 * @throws An `Error` carrying the proxy's message when the request fails, or
 *   when the reply has no bullets.
 */
export async function requestSpeechSummary(
  input: SpeechSummaryInput,
  options: SpeechAiRequestOptions = {},
): Promise<string> {
  const text = await askReasonAi(
    {
      system: SPEECH_SUMMARY_SYSTEM_PROMPT,
      prompt: buildSpeechSummaryPrompt(input),
      maxTokens: 1800,
      temperature: 0.3,
    },
    options,
  );
  const outline = parseSpeechSummaryResponse(text);
  if (!outline) throw new Error("The AI's reply couldn't be read as an outline. Try again.");
  return outline;
}
