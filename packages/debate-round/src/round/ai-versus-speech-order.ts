/**
 * @fileoverview AI-versus speech ordering — pure data-derivation helpers
 * for idea #3 in TODO.md ("Online Debate Versus AI"). Given a debate
 * format (from `debate-timer`'s `debateStyles` registry) and which side
 * the human user picked, derives the full ordered turn sequence tagged by
 * who speaks each slot, whose turn is next given how many speeches have
 * already been submitted, and a structured (non-AI-calling) request
 * object describing what the AI's next speech should respond to. This is
 * the first slice only — it doesn't call any AI model, accept text/audio
 * speech submissions, or persist round state; it's the turn-order data
 * layer a future online-versus-AI round flow and its speech-submission
 * UI could build on. See the follow-ups noted in TODO.md.
 */

import type { DebateStyleKey } from "debate-timer/src/formats/debate-format-times";
import { debateStyles } from "debate-timer/src/formats/debate-format-times";
import type { TimerSpeech } from "debate-timer/src/types";

export type AiVersusSide = "primary" | "secondary";
export type AiVersusSpeaker = "user" | "ai";

export type AiVersusSpeechSlot = {
  /** Position of this speech within the round's speech order (0-based). */
  index: number;
  name: string;
  secondary: boolean;
  time: number;
  speaker: AiVersusSpeaker;
  cxRoles?: { questioner: string; answerer: string };
};

function speechBelongsToUser(speech: TimerSpeech, userSide: AiVersusSide): boolean {
  const isPrimarySpeech = !speech.secondary;
  return userSide === "primary" ? isPrimarySpeech : !isPrimarySpeech;
}

/**
 * Flattens a format's `timerSpeeches` (see `debateStyles`) into an ordered
 * turn list tagged with who speaks each slot, given which side the human
 * user picked. Formats with no `secondary` side defined (e.g. Congress)
 * have every slot on the same side as `userSide === "primary"`.
 */
export function buildAiVersusSpeechOrder(
  styleKey: DebateStyleKey,
  userSide: AiVersusSide = "primary",
): AiVersusSpeechSlot[] {
  return debateStyles[styleKey].timerSpeeches.map((speech, index) => ({
    index,
    name: speech.name,
    secondary: speech.secondary,
    time: speech.time,
    speaker: speechBelongsToUser(speech, userSide) ? "user" : "ai",
    ...(speech.cxRoles ? { cxRoles: speech.cxRoles } : {}),
  }));
}

/** The next slot to be delivered given how many speeches have already been submitted, or `null` once the round is complete. */
export function getNextSpeechSlot(
  order: AiVersusSpeechSlot[],
  submittedCount: number,
): AiVersusSpeechSlot | null {
  return order[submittedCount] ?? null;
}

/** Whether the user (rather than the AI, or nobody once the round is over) speaks next. */
export function isUsersTurn(order: AiVersusSpeechSlot[], submittedCount: number): boolean {
  return getNextSpeechSlot(order, submittedCount)?.speaker === "user";
}

export type SpeechSubmissionValidation = { valid: true } | { valid: false; reason: string };

/**
 * Checks whether a user-submitted speech named `speechName` is the one
 * currently expected — the round isn't already complete, it isn't the
 * AI's turn, and the name matches the next slot exactly.
 */
export function validateSpeechSubmission(
  order: AiVersusSpeechSlot[],
  submittedCount: number,
  speechName: string,
): SpeechSubmissionValidation {
  const expected = getNextSpeechSlot(order, submittedCount);
  if (!expected) {
    return { valid: false, reason: "The round is already complete; no more speeches are expected." };
  }
  if (expected.speaker !== "user") {
    return { valid: false, reason: `It is the AI's turn to deliver "${expected.name}", not the user's.` };
  }
  if (expected.name !== speechName) {
    return { valid: false, reason: `Expected "${expected.name}" next, but received "${speechName}".` };
  }
  return { valid: true };
}

export type PriorSpeechRecord = { name: string; speaker: AiVersusSpeaker; text: string };

export type AiSpeechRequest = {
  slot: AiVersusSpeechSlot;
  /** Prior speeches in delivery order, for the AI to condition its response on. */
  priorSpeeches: PriorSpeechRecord[];
  /** True when this slot is a cross-examination turn rather than a prepared speech. */
  isCrossExamination: boolean;
};

/**
 * Builds a structured request describing the AI's next speech — which
 * slot it fills and what prior speeches it should respond to — or `null`
 * when it isn't currently the AI's turn (round complete, or the user
 * speaks next). Does not call any AI model itself; this is the request
 * shape a future prompt-builder would consume.
 */
export function buildAiResponseRequest(
  order: AiVersusSpeechSlot[],
  submittedCount: number,
  priorSpeeches: PriorSpeechRecord[],
): AiSpeechRequest | null {
  const slot = getNextSpeechSlot(order, submittedCount);
  if (!slot || slot.speaker !== "ai") return null;

  return {
    slot,
    priorSpeeches,
    isCrossExamination: Boolean(slot.cxRoles),
  };
}
