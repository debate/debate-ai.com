/**
 * @fileoverview The prompts the AI opponent and the AI judge of an Online
 * Challenge are given, and the reader for the judge's answer. Pure strings in,
 * strings out; the app's `lib/debate-challenges/ai.ts` makes the model calls.
 *
 * @module debate-practice-rounds/debate-challenges/prompts
 */

import {
  CHALLENGE_FORMATS,
  SPEECH_ORDER,
  challengeOptionLabel,
  type AiLevel,
  type ChallengeFormat,
  type ChallengeSide,
  type ChallengeSpeech,
} from "./types";

/** What the prompts need to know about a round. */
export interface PromptRound {
  format: ChallengeFormat;
  topic: string;
  speeches: readonly ChallengeSpeech[];
}

const LEVEL_STYLE: Record<AiLevel, string> = {
  novice:
    "You are a first-year novice debater. Make two or three simple arguments in plain language, with general reasoning rather than evidence, and leave a few obvious gaps an opponent could exploit.",
  varsity:
    "You are a solid varsity debater. Make clear, well-warranted arguments, answer the other side directly, and weigh at the end.",
  champion:
    "You are a national-champion debater. Be precise and strategic: preempt likely answers, turn the other side's arguments where you can, extend only what wins, and weigh explicitly on magnitude, probability and timeframe.",
};

/** Longest an AI speech should run, in words. */
export const AI_SPEECH_WORDS = 450;

function transcript(speeches: readonly ChallengeSpeech[]): string {
  if (speeches.length === 0) return "(No speeches yet.)";
  return speeches
    .map((speech, index) => `### ${SPEECH_ORDER[index]?.label ?? `Speech ${index + 1}`}\n${speech.text.trim()}`)
    .join("\n\n");
}

/** The prompt for the AI's next speech. */
export function aiSpeechPrompt(round: PromptRound, level: AiLevel): string {
  const next = SPEECH_ORDER[round.speeches.length];
  const side = next?.side ?? "neg";
  const speech = next?.label ?? "Rebuttal";
  const rebuttal = round.speeches.length >= 2;
  return [
    `You are debating a written ${challengeOptionLabel(CHALLENGE_FORMATS, round.format)} round.`,
    `Resolution: ${round.topic}`,
    `Your side: ${side === "aff" ? "Affirmative (for the resolution)" : "Negative (against the resolution)"}.`,
    LEVEL_STYLE[level],
    "",
    "The round so far:",
    transcript(round.speeches),
    "",
    `Write the ${speech}. ${
      rebuttal
        ? "Answer the other side's arguments, extend your best ones, and tell the judge why you win."
        : "Lay out your case with clear contentions; if the other side has spoken, answer them too."
    }`,
    `Keep it under ${AI_SPEECH_WORDS} words. Write only the speech itself — no title, no notes to the reader, no Markdown headings.`,
  ].join("\n");
}

/** The prompt for the judge's decision. */
export function judgePrompt(round: PromptRound): string {
  return [
    `You are an experienced, fair judge of a written ${challengeOptionLabel(CHALLENGE_FORMATS, round.format)} debate.`,
    `Resolution: ${round.topic}`,
    "",
    transcript(round.speeches),
    "",
    "Decide who won on the arguments made in the round, not your own views on the topic. Reward clash, warrants, responses to the other side and weighing; ignore length for its own sake.",
    'Answer with JSON only, in this exact shape: {"winner": "aff" | "neg", "reason": "<a reason for decision of 3-6 sentences, addressed to both debaters>"}',
  ].join("\n");
}

/** The judge's answer, or `null` when it names no winner. */
export function parseJudgeReply(reply: string): { winner: ChallengeSide; reason: string } | null {
  const match = reply.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const value = JSON.parse(match[0]) as { winner?: unknown; reason?: unknown };
      const winner = typeof value.winner === "string" ? value.winner.trim().toLowerCase() : "";
      if (winner === "aff" || winner === "neg") {
        return { winner, reason: typeof value.reason === "string" ? value.reason.trim() : "" };
      }
    } catch {
      // Fall through to the plain-text reading below.
    }
  }
  const plain = reply.match(/winner"?\s*[:=-]?\s*"?(aff|neg)/i);
  if (plain) return { winner: plain[1].toLowerCase() as ChallengeSide, reason: reply.trim().slice(0, 2000) };
  return null;
}
