/**
 * @fileoverview Pure prompt-building and response-parsing helpers for
 * follow-up (b) under the "📚 AI Drill Generator" bullet in TODO.md's
 * Research Crowdsourcing Organizer Features list: "an actual AI-generated
 * (rather than templated) script." `flow/drill-generator.ts`'s
 * `buildDrillSet` already turns a flowed round into overview/frontline/
 * cross-ex/collapse template drill prompts; this module composes a single
 * one of those drills into a request asking the model for an actual,
 * ready-to-read practice script — not another restatement of the template
 * prompt line.
 *
 * This file makes no network call itself (see `drill-script-client.ts` for
 * that) so the prompt-building and parsing logic can be exercised directly
 * in Vitest without mocking `fetch`, mirroring `coach-feedback-ai.ts`'s
 * split. The reply is free-form prose, not JSON — a practice script is
 * exactly that.
 *
 * @module round/drill-script-ai
 */

import type { Drill, DrillKind } from "../flow/drill-generator";

export type DrillScriptAiInput = {
  /** The side the drill was generated for, e.g. `"AFF"`. */
  sideKey: string;
  /** The already-generated template drill this script expands on. */
  drill: Drill;
};

const DRILL_KIND_LABELS: Record<DrillKind, string> = {
  overview: "Overview",
  frontline: "Frontline",
  cross_ex: "Cross-Ex",
  collapse: "Collapse",
};

/**
 * System prompt instructing the model to turn a fixed template drill prompt
 * into an actual, ready-to-read practice script, and to reply with the
 * script text only — no preamble, no meta-commentary about being an AI, no
 * markdown code fences — so `parseDrillScriptAiResponse` can use the reply
 * directly.
 */
export const DRILL_SCRIPT_AI_SYSTEM_PROMPT =
  "You are a debate practice partner turning a short, templated practice-drill prompt into an " +
  "actual, ready-to-read practice script for one debater on one side of a round. You will be given " +
  "the drill's kind — overview, frontline, cross-ex, or collapse — and its template prompt line. " +
  "Write the actual script: full sentences a debater could read aloud or rehearse from, not another " +
  "restatement of the prompt. Stay grounded in exactly what the prompt describes — don't invent new " +
  "arguments, evidence, or claims about the round that aren't implied by it.\n\n" +
  "Reply with the script text ONLY — no preamble like \"Here's your script\", no meta-commentary " +
  "about being an AI, and no markdown code fences.";

/**
 * Builds the user-turn message text for a drill-script AI request: the side
 * being drilled, the drill's kind, and its template prompt line.
 */
export function buildDrillScriptAiUserPrompt(input: DrillScriptAiInput): string {
  const { sideKey, drill } = input;

  return (
    `Side: ${sideKey}\n` +
    `Drill kind: ${DRILL_KIND_LABELS[drill.kind]}\n` +
    `Template prompt: ${drill.prompt}\n\n` +
    "Write the actual practice script for this drill."
  );
}

/**
 * Tolerantly parses a model reply into script text: trims surrounding
 * whitespace and strips a wrapping ```-fence (with an optional language
 * tag) if present, mirroring `coach-feedback-ai.ts`'s
 * `parseCoachFeedbackAiResponse`. Returns `null` — rather than an empty
 * string — when nothing usable remains, so a blank AI reply degrades
 * gracefully instead of persisting an empty script.
 */
export function parseDrillScriptAiResponse(raw: string): string | null {
  let text = raw.trim();
  if (!text) return null;

  const fenceMatch = text.match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/);
  if (fenceMatch) text = fenceMatch[1].trim();

  return text.length > 0 ? text : null;
}
