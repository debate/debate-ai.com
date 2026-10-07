/**
 * @fileoverview One speech, outlined — the watch page's "AI summary" button.
 *
 * A debater re-watching a round wants a speech on one screen the way it
 * would sit on their flow: what the speaker argued, in the order they argued
 * it, each claim with the warrant behind it, in clipped phrases rather than
 * prose. This module builds that request from the speech's transcript (its
 * captions, once the speech has a start) and tidies the reply into a
 * Markdown bullet outline the watch page renders like any other document.
 *
 * Pure prompt building and parsing only; `speech-ai-client.ts` makes the
 * network call.
 * @module lib/speech-summary
 */

import type { SpeechSide } from "./round-speeches";

/** The longest transcript one summary sends — a long rebuttal is well under it. */
export const MAX_SUMMARY_TRANSCRIPT_CHARS = 60_000;

export const SPEECH_SUMMARY_SYSTEM_PROMPT = `You are an expert competitive debate coach who flows rounds for a living. Given the transcript of one speech (or cross-examination) from a recorded round, write the outline a strong debater would put on their flow.

RULES:
- Bullet points only, in the order the speaker made the arguments. Use the speaker's own structure: off-case positions, contentions, advantages, or the order they went down the flow.
- Top-level bullets are the key points (a contention, an off-case position, an answer to an argument, a voting issue). Write each as a short tag in bold, e.g. **DA — Midterms**.
- Under each, nested bullets give the key warrants: the reason, evidence or link chain behind the claim, the impact, and any weighing. Name the card or author when the speaker reads one.
- Clipped phrases, not sentences: "plan → political capital loss → no infra bill", not "The speaker argues that...". Arrows (→) for link chains are welcome.
- For a cross-examination, outline the lines of questioning and what each one established or conceded.
- Keep it faithful. Do not add arguments, evidence or rebuttals that are not in the transcript. Captions are auto-generated, so silently fix obvious mis-hearings of debate terms (e.g. "dis ad" → DA, "counter plan" → CP, "perm" → permutation).
- Finish with a "**Bottom line**" bullet: one phrase on what the speech is going for.

Reply with ONLY the Markdown bullet outline — no heading, preamble or closing remarks.`;

const SIDE_NAMES: Record<SpeechSide, string> = {
  aff: "Affirmative / Pro",
  neg: "Negative / Con",
  cx: "Cross-examination",
  neutral: "Neutral",
};

export interface SpeechSummaryInput {
  /** The speech's heading — `1AC — First Affirmative Constructive`. */
  heading: string;
  side: SpeechSide;
  transcript: string;
  videoTitle?: string;
  format?: string;
}

/** The user turn: what the speech is, then its words. */
export function buildSpeechSummaryPrompt(input: SpeechSummaryInput): string {
  const transcript = input.transcript.trim();
  const clipped = transcript.length > MAX_SUMMARY_TRANSCRIPT_CHARS;
  const lines: string[] = [];
  if (input.videoTitle) lines.push(`Round: ${input.videoTitle}`);
  if (input.format) lines.push(`Format: ${input.format}`);
  lines.push(
    `Speech: ${input.heading}`,
    `Side: ${SIDE_NAMES[input.side]}`,
    "",
    `Transcript${clipped ? " (cut off)" : ""}:`,
    clipped ? transcript.slice(0, MAX_SUMMARY_TRANSCRIPT_CHARS) : transcript,
    "",
    "Outline this speech's key points and key warrants as bullet-point phrases.",
  );
  return lines.join("\n");
}

/**
 * Tidies the reply into a bullet outline: drops a code fence and any
 * preamble before the first bullet, and turns `*` / `•` bullets into `-`.
 *
 * @returns The Markdown outline, or `null` when the reply has no bullets.
 */
export function parseSpeechSummaryResponse(text: string): string | null {
  const unfenced = text.replace(/^\s*```(?:markdown|md)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  const lines = unfenced.split("\n").map((line) => line.replace(/^(\s*)(?:[*•]|\d+[.)])\s+/, "$1- "));
  const first = lines.findIndex((line) => /^\s*-\s+\S/.test(line));
  if (first === -1) return null;
  const outline = lines.slice(first).join("\n").trim();
  return outline || null;
}
