/**
 * @fileoverview The network half of "Do the full speech" — see
 * `speech-redo.ts` for the prompt and the parser.
 *
 * Posts to the shared `/api/reason-ai` proxy, the same contract the
 * Alternatives run uses (`speech-outcomes-client.ts`), so the proxy's
 * sign-in gate and its `{ error }` messages apply unchanged.
 * @module lib/speech-redo-client
 */

import {
  SPEECH_REDO_SYSTEM_PROMPT,
  buildSpeechRedoPrompt,
  parseSpeechRedoResponse,
  redoSpeechMinutes,
  speechRedoMaxTokens,
  type SpeechRedoInput,
} from "./speech-redo";

export interface RequestSpeechRedoOptions {
  endpoint?: string;
  signal?: AbortSignal;
}

/**
 * Asks Claude for the full speech in one alternative's direction.
 *
 * @returns The speech as Markdown.
 * @throws An `Error` carrying the proxy's message when the request fails or
 *   the reply is empty.
 */
export async function requestSpeechRedo(
  input: SpeechRedoInput,
  { endpoint = "/api/reason-ai", signal }: RequestSpeechRedoOptions = {},
): Promise<string> {
  const speech = input.speeches[input.index];
  if (!speech) throw new Error("There is no speech to redo.");
  const minutes = redoSpeechMinutes(speech, input.round?.format);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: SPEECH_REDO_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildSpeechRedoPrompt(input) }],
      maxTokens: speechRedoMaxTokens(minutes),
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
    throw new Error(detail || `Writing the speech failed (${res.status}).`);
  }

  const json = (await res.json()) as { text?: string };
  const speechText = parseSpeechRedoResponse(json.text ?? "");
  if (!speechText) throw new Error("Claude's reply was empty. Try again.");
  return speechText;
}
