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
import { captionPauseSegmentation } from "./caption-speech-split";
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
      free: true,
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
  const durationSeconds = input.captions.reduce(
    (latest, caption) => Math.max(latest, caption.start + (caption.duration ?? 0)),
    0,
  );
  const segmentation = parseSpeechSegmentationResponse(text, {
    durationSeconds: durationSeconds > 0 ? durationSeconds + 30 : undefined,
  });
  if (!segmentation) throw new Error("The AI couldn't find any speeches in these captions. Try again, or mark them by hand.");
  return segmentation;
}

/** What "Detect speeches" found, and how. */
export interface SpeechDetectionResult {
  segmentation: SpeechSegmentation;
  /** `"ai"` when the model placed the speeches, `"pauses"` when only the caption pauses did. */
  source: "ai" | "pauses";
  /** Why the model's answer wasn't used, when `source` is `"pauses"`. */
  aiError?: string;
}

/**
 * "Detect speeches": the caption pauses place the format's speeches by
 * length, the model corrects that guess from what is said, and when the model
 * can't be asked or answers nothing usable the pause placement stands.
 *
 * @param style The video's numeric `DebateStyle`, for the pause guess.
 * @throws Only when neither the model nor the pauses found any speech; the
 *   model's message is kept.
 */
export async function detectRoundSpeeches(
  input: Omit<SpeechSegmentationInput, "pauseGuess">,
  style: number | null | undefined,
  options: SpeechAiRequestOptions = {},
): Promise<SpeechDetectionResult> {
  const pauses = captionPauseSegmentation(input.captions, style);
  try {
    const segmentation = await requestSpeechSegmentation({ ...input, pauseGuess: pauses?.speeches }, options);
    return { segmentation, source: "ai" };
  } catch (error) {
    if (options.signal?.aborted || !pauses) throw error;
    return {
      segmentation: pauses,
      source: "pauses",
      aiError: error instanceof Error ? error.message : String(error),
    };
  }
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
