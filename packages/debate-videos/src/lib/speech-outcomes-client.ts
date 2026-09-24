/**
 * @fileoverview The network half of the watch page's "Outcomes" view — see
 * `speech-outcomes.ts` for the prompt and the parser.
 *
 * Posts to the app's shared `/api/reason-ai` Anthropic proxy, the same
 * `{ system, messages, maxTokens }` contract the practice and card-scoring
 * AI features use, rather than standing up a route of its own. The proxy
 * requires a signed-in session; its `{ error }` message ("Sign in to use AI
 * features.") is surfaced as-is.
 * @module lib/speech-outcomes-client
 */

import {
  SPEECH_OUTCOME_SYSTEM_PROMPT,
  buildSpeechOutcomePrompt,
  clampAlternativeCount,
  parseSpeechOutcomeResponse,
  type SpeechOutcomeInput,
  type SpeechOutcomeSimulation,
} from "./speech-outcomes";

/** Each alternative is an outline plus a ballot; four of them fit comfortably. */
const MAX_TOKENS = 3200;

export interface RequestSpeechOutcomesOptions {
  endpoint?: string;
  signal?: AbortSignal;
}

/**
 * Asks Claude for alternative responses to one speech and a predicted ballot
 * after each.
 *
 * @throws An `Error` carrying the proxy's message when the request fails, or
 *   when the reply cannot be read as a simulation.
 */
export async function requestSpeechOutcomes(
  input: SpeechOutcomeInput,
  { endpoint = "/api/reason-ai", signal }: RequestSpeechOutcomesOptions = {},
): Promise<SpeechOutcomeSimulation> {
  const count = clampAlternativeCount(input.count);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: SPEECH_OUTCOME_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildSpeechOutcomePrompt({ ...input, count }) }],
      maxTokens: MAX_TOKENS,
      temperature: 0.7,
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
    throw new Error(detail || `The simulation request failed (${res.status}).`);
  }

  const json = (await res.json()) as { text?: string };
  const simulation = parseSpeechOutcomeResponse(json.text ?? "", count);
  if (!simulation) throw new Error("Claude's reply couldn't be read as a simulation. Try running it again.");
  return simulation;
}
