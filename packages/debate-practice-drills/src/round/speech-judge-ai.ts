/**
 * @fileoverview Judge any set of pasted speeches with the Standard Judge.
 *
 * The AI Judge Decision page's round-ID flow needs a saved flow summary and
 * paradigm; this is the lighter path beside it: the user pastes each speech
 * (e.g. copied out of their CardMirror docs) into an editable list, and the
 * Standard Judge (`standard-judge-prompt.ts`) returns a written decision
 * plus a critique of each speech with alternative choices the debater
 * could have made. The reply is Markdown prose, shown as-is, not JSON.
 *
 * @module round/speech-judge-ai
 */

import { STANDARD_JUDGE_SYSTEM_PROMPT } from "./standard-judge-prompt";

/** Which side gave a speech. */
export type SpeechSide = "aff" | "neg";

/** One speech in the round, in speaking order. */
export type JudgedSpeech = {
  id: string;
  /** Speech name shown to the user and the judge, e.g. "1AC". */
  name: string;
  side: SpeechSide;
  /** The speech's pasted text (speech doc or transcript). */
  text: string;
};

export const SPEECH_SIDE_LABEL: Record<SpeechSide, string> = {
  aff: "Aff",
  neg: "Neg",
};

/** The default 8-speech layout, alternating Aff and Neg. */
export const ALTERNATING_EIGHT_SPEECH_PRESET: ReadonlyArray<Pick<JudgedSpeech, "name" | "side">> = [
  { name: "1AC", side: "aff" },
  { name: "1NC", side: "neg" },
  { name: "2AC", side: "aff" },
  { name: "2NC", side: "neg" },
  { name: "1AR", side: "aff" },
  { name: "1NR", side: "neg" },
  { name: "2AR", side: "aff" },
  { name: "2NR", side: "neg" },
];

/** Replies are a full written ballot plus per-speech critiques. */
const MAX_TOKENS = 8192;

let idCounter = 0;

/** A process-unique speech id (no crypto dependency, fine for list keys). */
export function generateSpeechId(): string {
  idCounter += 1;
  return `speech-${Date.now().toString(36)}-${idCounter}`;
}

/** Fresh, empty speeches for the default 8-speech alternating layout. */
export function createPresetSpeeches(): JudgedSpeech[] {
  return ALTERNATING_EIGHT_SPEECH_PRESET.map((speech) => ({ ...speech, id: generateSpeechId(), text: "" }));
}

/** The side that should speak after `speeches`, so a new speech keeps the alternation. */
export function nextSpeechSide(speeches: ReadonlyArray<JudgedSpeech>): SpeechSide {
  const last = speeches[speeches.length - 1];
  return last?.side === "aff" ? "neg" : "aff";
}

/**
 * Builds the user turn: judge instructions, then every speech in order with
 * its side and name. Empty speeches are listed as "not provided" so the
 * judge can note them under Limitations rather than guessing their content.
 */
export function buildSpeechJudgeUserPrompt(speeches: ReadonlyArray<JudgedSpeech>): string {
  const transcript = speeches
    .map((speech, index) => {
      const heading = `### Speech ${index + 1}: ${speech.name.trim() || `Speech ${index + 1}`} (${SPEECH_SIDE_LABEL[speech.side]})`;
      const body = speech.text.trim() || "[Not provided]";
      return `${heading}\n\n${body}`;
    })
    .join("\n\n---\n\n");

  return (
    "Judge the following debate round. The speeches are listed in speaking order, each labeled with " +
    "the side (Aff or Neg) that gave it. The text may be pasted from speech documents and include " +
    "card tags, citations, and evidence.\n\n" +
    "Produce your decision in the Required Decision Format. Then add a final section:\n\n" +
    "## Critique and Alternatives\n\n" +
    "For each speech in order, give a short critique of what worked and what did not, and suggest " +
    "specific alternative choices the debater could have made (arguments to answer, extend, collapse " +
    "on, or weigh differently) to improve their side's position. Base every critique only on the " +
    "record below.\n\n" +
    "# Round record\n\n" +
    transcript
  );
}

/** Whether at least one speech has text worth judging. */
export function hasSpeechContent(speeches: ReadonlyArray<JudgedSpeech>): boolean {
  return speeches.some((speech) => speech.text.trim().length > 0);
}

/**
 * Asks the Standard Judge to decide the round in `speeches` via
 * `/api/reason-ai` (or `endpoint`), returning its Markdown reply.
 *
 * Throws with the proxy's `{ error }` message when the request fails, or
 * when the reply is empty.
 */
export async function requestSpeechJudgeDecision(
  speeches: ReadonlyArray<JudgedSpeech>,
  endpoint = "/api/reason-ai",
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: STANDARD_JUDGE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildSpeechJudgeUserPrompt(speeches) }],
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
    throw new Error(detail || `AI judge request failed (${res.status}).`);
  }

  const json = (await res.json()) as { text?: string };
  const text = (json.text ?? "").trim();
  if (!text) throw new Error("The AI judge returned an empty decision.");
  return text;
}
