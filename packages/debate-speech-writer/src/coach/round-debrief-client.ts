/**
 * @fileoverview Network call for the Practice vs AI **Coach debrief** — see
 * `round-debrief-ai.ts`. Posts the same `{ system, messages, maxTokens }`
 * contract to the existing `/api/reason-ai` server-side proxy that
 * `team-coach-client.ts` uses, so it inherits that route's sign-in and
 * configuration gates.
 *
 * @module coach/round-debrief-client
 */

import type { CoachPersonaId } from "./coach-personas";
import {
  buildRoundDebriefSystemPrompt,
  buildRoundDebriefUserPrompt,
  parseRoundDebriefResponse,
  type RoundDebriefInput,
} from "./round-debrief-ai";

/** A debrief is a few short paragraphs. */
const MAX_TOKENS = 1024;

export interface RequestRoundDebriefOptions {
  /** Coaching style. Omitted or unknown means Standard. */
  personaId?: CoachPersonaId;
  /** Aborts the request, e.g. when the scorecard closes. */
  signal?: AbortSignal;
}

/**
 * Requests a coach debrief of a finished round from `/api/reason-ai` (or
 * `endpoint`), returning the parsed text.
 *
 * Throws an `Error` with a useful message when the request fails (the
 * proxy's `{ error }` when it sends one, e.g. "Sign in to use AI features.")
 * or the reply is empty.
 */
export async function requestRoundDebrief(
  input: RoundDebriefInput,
  options: RequestRoundDebriefOptions = {},
  endpoint = "/api/reason-ai",
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: buildRoundDebriefSystemPrompt(options.personaId),
      messages: [{ role: "user", content: buildRoundDebriefUserPrompt(input) }],
      maxTokens: MAX_TOKENS,
    }),
    signal: options.signal,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const payload = (await res.json()) as { error?: string };
      detail = payload?.error ?? "";
    } catch {
      // Body wasn't JSON.
    }
    throw new Error(detail || `Coach debrief request failed (${res.status}).`);
  }

  const json = (await res.json()) as { text?: string };
  const debrief = parseRoundDebriefResponse(json.text ?? "");
  if (!debrief) throw new Error("AI returned an empty or unusable debrief.");
  return debrief;
}
