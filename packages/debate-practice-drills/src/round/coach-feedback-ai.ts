/**
 * @fileoverview Pure prompt-building and response-parsing helpers for
 * follow-up (a) under the "🎙️ AI Coach Mode" bullet in TODO.md's Research
 * Crowdsourcing Organizer Features list: "an actual AI coaching call for
 * open-ended feedback beyond this deterministic template layer."
 * `flow/coach-mode.ts`'s `buildCoachingSession`/`buildCoachingSummaryText`
 * already turn a flowed round into extension/refutation/collapse/weighing
 * template prompts for a side; this module composes that summary into a
 * request asking the model for open-ended, personalized coaching feedback
 * that goes beyond the fixed template wording — grounded strictly in what
 * the template prompts already surfaced, not free-inventing new claims
 * about the round.
 *
 * This file makes no network call itself (see `coach-feedback-client.ts`
 * for that) so the prompt-building and parsing logic can be exercised
 * directly in Vitest without mocking `fetch`, mirroring
 * `coach/team-coach-ai.ts`'s split. The reply is free-form prose, not JSON
 * — like `team-coach-ai.ts`'s Q&A call and unlike `judge-decision-ai.ts`'s
 * structured verdict — because "open-ended feedback" is exactly that.
 *
 * @module round/coach-feedback-ai
 */

import type { CoachingPrompt } from "debate-round/src/flow/coach-mode";
import { buildCoachingSummaryText } from "debate-round/src/flow/coach-mode";

export type CoachFeedbackAiInput = {
  /** The side the coaching session was generated for, e.g. `"AFF"`. */
  sideKey: string;
  /** The round's already-generated template prompts, e.g. `buildCoachingSession`'s output. */
  prompts: CoachingPrompt[];
};

/**
 * System prompt instructing the model to act as a debate coach expanding on
 * a fixed template's bullet-point prompts with open-ended, personalized
 * feedback, and to reply with the feedback text only — no preamble, no
 * meta-commentary about being an AI, no markdown code fences — so
 * `parseCoachFeedbackAiResponse` can use the reply directly.
 */
export const COACH_FEEDBACK_AI_SYSTEM_PROMPT =
  "You are a debate coach giving a team open-ended, spoken-style feedback for one side of a round. " +
  "You will be given that side's template coaching prompts — labeled extension, refutation, " +
  "collapse, or weighing — already derived from the round's flow. Expand on them the way a coach " +
  "would in a debrief: explain the reasoning behind each priority, note how they connect to each " +
  "other (e.g. why answering one argument matters more given the weighing angle), and add any " +
  "practical delivery or strategy advice a template line can't capture. Stay grounded in what the " +
  "prompts actually say — don't invent new arguments, evidence, or claims about the round that " +
  "aren't implied by them.\n\n" +
  "Reply with the feedback text ONLY — no preamble like \"Here's my feedback\", no meta-commentary " +
  "about being an AI, and no markdown code fences.";

/**
 * Builds the user-turn message text for a coach-feedback AI request: the
 * side being coached and its template coaching session, rendered via the
 * existing `buildCoachingSummaryText` rather than re-serializing
 * `CoachingPrompt[]` a second way.
 */
export function buildCoachFeedbackAiUserPrompt(input: CoachFeedbackAiInput): string {
  const { sideKey, prompts } = input;

  return (
    `Side being coached: ${sideKey}\n\n` +
    "Template coaching prompts for this side:\n" +
    '"""\n' +
    `${buildCoachingSummaryText(prompts)}\n` +
    '"""\n\n' +
    "Give open-ended coaching feedback expanding on these prompts."
  );
}

/**
 * Tolerantly parses a model reply into feedback text: trims surrounding
 * whitespace and strips a wrapping ```-fence (with an optional language
 * tag) if present, mirroring `coach/team-coach-ai.ts`'s
 * `parseTeamCoachAiResponse`. Returns `null` — rather than an empty string
 * — when nothing usable remains, so a blank AI reply degrades gracefully
 * instead of persisting empty feedback.
 */
export function parseCoachFeedbackAiResponse(raw: string): string | null {
  let text = raw.trim();
  if (!text) return null;

  const fenceMatch = text.match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/);
  if (fenceMatch) text = fenceMatch[1].trim();

  return text.length > 0 ? text : null;
}
