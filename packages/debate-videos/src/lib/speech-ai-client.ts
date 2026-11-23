/**
 * @fileoverview The network half of the watch page's two transcript AI
 * buttons — "Detect speeches" (`speech-segmentation.ts`) and a speech's
 * "AI summary" (`speech-summary.ts`).
 *
 * Both post to the app's shared `/api/reason-ai` proxy, the same
 * `{ system, messages, maxTokens }` contract the Outcomes simulator uses.
 * The proxy picks the key: the user's own OpenRouter or Anthropic key first
 * when they saved one (the app attaches it to these requests itself), then
 * the site's shared OpenRouter and Anthropic keys if the own key fails. It requires a signed-in session; its `{ error }` message
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
  LECTURE_SUMMARY_SYSTEM_PROMPT,
  SPEECH_SUMMARY_SYSTEM_PROMPT,
  buildLectureSummaryPrompt,
  buildSpeechSummaryPrompt,
  parseSpeechSummaryResponse,
  type SpeechSummaryInput,
} from "./speech-summary";
import {
  FLOW_CHART_SYSTEM_PROMPT,
  buildFlowChartPrompt,
  parseFlowChartResponse,
  type DebateFlowChart,
  type FlowChartPromptInput,
} from "./debate-flow-chart";

export interface SpeechAiRequestOptions {
  endpoint?: string;
  signal?: AbortSignal;
}

/** Statuses worth asking again: timeouts, rate limits and upstream hiccups. */
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/** A failed AI request, with whether asking again could help. */
export class SpeechAiError extends Error {
  status?: number;
  retryable: boolean;
  constructor(message: string, { status, retryable }: { status?: number; retryable: boolean }) {
    super(message);
    this.name = "SpeechAiError";
    this.status = status;
    this.retryable = retryable;
  }
}

/** Whether a failure from `askReasonAi` or a reply parser is worth another try. */
export function isRetryableAiError(error: unknown): boolean {
  if (error instanceof SpeechAiError) return error.retryable;
  // fetch rejects with a TypeError when the network drops.
  return error instanceof TypeError;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/**
 * Runs `task` up to `attempts` times, waiting `delays[i]` ms between tries,
 * while the failure is retryable (`isRetryableAiError`) and not aborted.
 */
export async function withAiRetries<T>(
  task: () => Promise<T>,
  { attempts = 3, delays = [1500, 4000], signal }: { attempts?: number; delays?: number[]; signal?: AbortSignal } = {},
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (signal?.aborted || !isRetryableAiError(error) || i === attempts - 1) throw error;
      await wait(delays[Math.min(i, delays.length - 1)] ?? 2000, signal);
    }
  }
  throw lastError;
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
    let planLimit = false;
    try {
      const body = (await res.json()) as { error?: string; limit?: unknown };
      detail = body?.error ?? "";
      planLimit = body?.limit !== undefined;
    } catch {
      // Body wasn't JSON.
    }
    throw new SpeechAiError(detail || `The AI request failed (${res.status}).`, {
      status: res.status,
      // Free models are often busy (upstream 429 / 5xx) and answer a moment later;
      // signing in or the plan's daily limit won't change on a retry.
      retryable: RETRYABLE_STATUSES.has(res.status) && !planLimit,
    });
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
  options: SpeechAiRequestOptions & { attempts?: number } = {},
): Promise<string> {
  // The free router picks a different model each call, so a busy model or a
  // reply that isn't an outline is usually fixed by simply asking again.
  return withAiRetries(
    async () => {
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
      if (!outline) {
        throw new SpeechAiError("The AI's reply couldn't be read as an outline. Try again.", { retryable: true });
      }
      return outline;
    },
    { attempts: options.attempts ?? 3, signal: options.signal },
  );
}

/**
 * Asks the model for a lecture's (any non-round video's) key points and
 * warrants as a bullet outline, from its whole caption track.
 *
 * @throws An `Error` carrying the proxy's message when the request fails, or
 *   when the reply has no bullets.
 */
export async function requestLectureSummary(
  input: { transcript: string; videoTitle?: string },
  options: SpeechAiRequestOptions & { attempts?: number } = {},
): Promise<string> {
  return withAiRetries(
    async () => {
      const text = await askReasonAi(
        {
          system: LECTURE_SUMMARY_SYSTEM_PROMPT,
          prompt: buildLectureSummaryPrompt(input),
          maxTokens: 2400,
          temperature: 0.3,
        },
        options,
      );
      const outline = parseSpeechSummaryResponse(text);
      if (!outline) {
        throw new SpeechAiError("The AI's reply couldn't be read as an outline. Try again.", { retryable: true });
      }
      return outline;
    },
    { attempts: options.attempts ?? 3, signal: options.signal },
  );
}

/**
 * Asks the model for the whole round as a mind map, built from the speeches'
 * outlines (the watch page's "Flow chart" button).
 *
 * @throws An `Error` carrying the proxy's message when the request fails, or
 *   when the reply holds no usable bubble.
 */
export async function requestFlowChart(
  input: FlowChartPromptInput,
  options: SpeechAiRequestOptions = {},
): Promise<DebateFlowChart> {
  return withAiRetries(
    async () => {
      const text = await askReasonAi(
        {
          system: FLOW_CHART_SYSTEM_PROMPT,
          prompt: buildFlowChartPrompt(input),
          maxTokens: 6000,
          temperature: 0.2,
        },
        options,
      );
      const chart = parseFlowChartResponse(text);
      if (!chart) {
        throw new SpeechAiError("The AI's reply couldn't be read as a flow chart. Try again.", { retryable: true });
      }
      return chart;
    },
    { signal: options.signal },
  );
}
