/**
 * @fileoverview The prompts behind a rebuttal drill — the AI partner's
 * rebuttal, the AI coach's help on a draft, and the AI judge — and the reader
 * for the judge's answer. Pure strings in, strings out; the app's
 * `lib/rebuttal-drills/store.ts` makes the model calls.
 *
 * These are specific to this drill (one recorded round, two redone
 * rebuttals), so they live beside it, as the Online Challenges prompts do,
 * rather than in `debate-speech-writer`.
 *
 * Students are often minors: the coach and the judge critique the argument,
 * never the person, and say when they are unsure what happened in the video.
 *
 * @module debate-practice-rounds/rebuttal-playlists/prompts
 */

import { CHALLENGE_FORMATS, challengeOptionLabel } from "../debate-challenges/types";
import { parseJudgeReply } from "../debate-challenges/prompts";
import type { DrillFormat, DrillSide, PlaylistVideo } from "./types";

/** What the prompts need to know about the drill's round. */
export interface DrillPromptRound {
  format: DrillFormat;
  video: Pick<PlaylistVideo, "title" | "tournament" | "round" | "affTeam" | "negTeam" | "lastRebuttal">;
}

/** Longest the AI partner's rebuttal should run, in words. */
export const AI_REBUTTAL_WORDS = 400;

const SIDE_NAME: Record<DrillSide, string> = { aff: "Affirmative", neg: "Negative" };

/** The last rebuttal each side gives in each format. */
const LAST_REBUTTAL: Record<DrillFormat, Record<DrillSide, string>> = {
  policy: { aff: "2AR", neg: "2NR" },
  ndt: { aff: "2AR", neg: "2NR" },
  ld: { aff: "2AR", neg: "NR" },
  pf: { aff: "Final Focus (first speaking team)", neg: "Final Focus (second speaking team)" },
  parli: { aff: "PMR", neg: "LOR" },
  worlds: { aff: "Proposition reply", neg: "Opposition reply" },
};

/** "2AR", "NR", "Final Focus…" — the speech a side redoes in this format. */
export function lastRebuttalName(format: DrillFormat, side: DrillSide): string {
  return LAST_REBUTTAL[format]?.[side] ?? `${SIDE_NAME[side]} rebuttal`;
}

function roundFacts(round: DrillPromptRound): string {
  const { video } = round;
  return [
    `Format: ${challengeOptionLabel(CHALLENGE_FORMATS, round.format)}.`,
    `Round: ${video.title}.`,
    `Affirmative: ${video.affTeam}. Negative: ${video.negTeam}.`,
    video.lastRebuttal ? `The library records the negative's last rebuttal as going for: ${video.lastRebuttal}.` : "",
    "You only have this description, not a transcript: reason about what the round most likely came down to, and say so when you are guessing.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The prompt for the AI partner's rebuttal on its side. */
export function aiRebuttalPrompt(round: DrillPromptRound, side: DrillSide): string {
  return [
    `You are a strong varsity debater redoing the ${lastRebuttalName(round.format, side)} for the ${SIDE_NAME[side]} in a famous recorded round, as a practice drill.`,
    roundFacts(round),
    "",
    `Write the ${SIDE_NAME[side]}'s final rebuttal: collapse to the arguments most likely to win, answer the other side's best ones, and weigh explicitly.`,
    `Keep it under ${AI_REBUTTAL_WORDS} words. Write only the speech itself — no title, no notes, no Markdown headings.`,
  ].join("\n");
}

/** The prompt for the AI coach's help on a student's draft. */
export function coachPrompt(round: DrillPromptRound, side: DrillSide, draft: string): string {
  return [
    `You are a supportive, expert debate coach. A student is redoing the ${lastRebuttalName(round.format, side)} for the ${SIDE_NAME[side]} in a recorded round, as a practice drill, and asks for help on their draft.`,
    roundFacts(round),
    "",
    "The student's draft:",
    draft.trim(),
    "",
    "Coach them without rewriting the speech for them. Give:",
    "1. What's working (one or two lines).",
    "2. The three most important fixes, most important first — e.g. a missing collapse, an unanswered argument, no weighing, a claim with no warrant.",
    "3. One sentence they could add to improve their weighing.",
    "Critique the argument, never the person. Keep it under 220 words, in plain text with short numbered points.",
  ].join("\n");
}

/** The prompt for the judge's decision on the two redone rebuttals. */
export function drillJudgePrompt(round: DrillPromptRound, aff: string, neg: string): string {
  return [
    "You are an experienced, fair debate judge scoring a rebuttal drill. Two students each redid one side's final rebuttal of the same recorded round.",
    roundFacts(round),
    "",
    `### Affirmative — ${lastRebuttalName(round.format, "aff")}`,
    aff.trim(),
    "",
    `### Negative — ${lastRebuttalName(round.format, "neg")}`,
    neg.trim(),
    "",
    "Decide whose rebuttal was stronger as a final rebuttal of this round: collapse, answering the other side, extending warrants, and weighing. Ignore length for its own sake and your own views on the topic.",
    "Critique the arguments, never the people. If the two are close, say so.",
    'Answer with JSON only, in this exact shape: {"winner": "aff" | "neg", "reason": "<a reason for decision of 3-5 sentences, then one line starting \\"Aff:\\" and one starting \\"Neg:\\" with the single most useful improvement for each>"}',
  ].join("\n");
}

/** The judge's answer, or `null` when it names no winner. Same reader as Online Challenges. */
export const parseDrillJudgeReply = parseJudgeReply;
