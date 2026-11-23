/**
 * @fileoverview The prompt that drafts a round's rebuttal redo assignments,
 * and the reader for its answer. Pure strings in, values out; the app's
 * `lib/rebuttal-redos/store.ts` makes the model call.
 *
 * Debaters are often minors: the assignment critiques the speech, never the
 * person, and says when the flow is too thin to be sure what happened.
 *
 * @module debate-practice-rounds/rebuttal-redos/prompts
 */

import { CHALLENGE_FORMATS, challengeOptionLabel } from "../debate-challenges/types";
import type { RedoSeat } from "./rules";
import type { RedoFormat, RedoSide } from "./types";

const SIDE_NAME: Record<RedoSide, string> = { aff: "Affirmative", neg: "Negative" };

/** What the prompt needs to know about the round. */
export interface RedoPromptRound {
  format: RedoFormat;
  roundTitle: string;
  winner: RedoSide | null;
  judgeNotes: string;
  /** What each rebuttal said, by speech name. */
  speeches: Record<string, string>;
}

/** One seat's label in the prompt and the reply: "Neg 2NR". */
export function seatLabel(seat: Pick<RedoSeat, "side" | "speech">): string {
  return `${seat.side === "aff" ? "Aff" : "Neg"} ${seat.speech}`;
}

/** The prompt asking for one assignment per seat, as JSON. */
export function redoAssignmentPrompt(round: RedoPromptRound, seats: readonly RedoSeat[]): string {
  const speechBlocks = seats.map((seat) => {
    const said = round.speeches[seatLabel(seat)]?.trim();
    return `### ${seatLabel(seat)} (${SIDE_NAME[seat.side]})\n${said || "(nothing was flowed for this speech)"}`;
  });
  return [
    "You are an expert, supportive debate coach. A round just ended, and the judge wants to give each debater a 'rebuttal redo': re-give their last rebuttal at home, fixing what went wrong, and record it for the judge to review.",
    `Format: ${challengeOptionLabel(CHALLENGE_FORMATS, round.format)}.`,
    `Round: ${round.roundTitle || "untitled round"}.`,
    round.winner ? `The ${SIDE_NAME[round.winner]} won.` : "The decision isn't recorded.",
    round.judgeNotes.trim() ? `Judge's notes / reason for decision:\n${round.judgeNotes.trim()}` : "",
    "",
    "What each rebuttal said, as the judge flowed it:",
    ...speechBlocks,
    "",
    "For each speech above, write the redo assignment the debater will read. Be concrete about this round: name the arguments to collapse to, the answers they missed or dropped, and the weighing to add. Give 3 to 5 numbered steps, then one line on how to run the redo (e.g. 'Give it once to the timer, then again cutting the weakest argument'). Under 150 words each. Critique the speech, never the person. If the flow is too thin to tell, say so and give general rebuttal fixes for this format.",
    "",
    'Answer with JSON only, no Markdown fence: {"assignments":[{"seat":"<the ### label exactly>","instructions":"<the assignment>"}]}',
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * Reads the model's answer into instructions per seat label. Tolerates a
 * Markdown fence or text around the JSON. Returns an empty map for anything
 * unreadable, so the caller falls back to {@link fallbackInstructions}.
 */
export function parseRedoAssignments(reply: string | null): Map<string, string> {
  const result = new Map<string, string>();
  if (!reply) return result;
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return result;
  try {
    const parsed = JSON.parse(reply.slice(start, end + 1)) as { assignments?: unknown };
    if (!Array.isArray(parsed.assignments)) return result;
    for (const item of parsed.assignments) {
      if (!item || typeof item !== "object") continue;
      const { seat, instructions } = item as { seat?: unknown; instructions?: unknown };
      if (typeof seat !== "string" || typeof instructions !== "string") continue;
      const text = instructions.trim();
      if (text) result.set(seat.replace(/^#+\s*/, "").replace(/\s*\(.*\)\s*$/, "").trim(), text.slice(0, 4000));
    }
  } catch {
    return result;
  }
  return result;
}

/** The assignment used when the model is unavailable: general fixes for that speech. */
export function fallbackInstructions(seat: Pick<RedoSeat, "side" | "speech">): string {
  return [
    `Redo your ${seat.speech} from this round.`,
    "1. Pick the one or two arguments you are most ahead on and collapse to them.",
    "2. Answer the other side's best argument directly before you extend your own.",
    "3. Extend each argument with its warrant, not just its tag.",
    "4. Weigh out loud: magnitude, probability and timeframe, compared with their impact.",
    "Give it once to the timer, then a second time cutting anything that didn't win the round.",
  ].join("\n");
}
