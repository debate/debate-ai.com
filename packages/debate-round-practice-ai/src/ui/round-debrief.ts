/**
 * @fileoverview Turns a finished Practice vs AI round (the judge's user-vs-bot
 * scorecard plus the room transcript) into the input for
 * `@debate-ai/speech-writer`'s Coach debrief prompt. Pure, so the mapping is
 * tested without rendering the scorecard.
 *
 * @module ui/round-debrief
 */

import type { RoundDebriefInput } from "@debate-ai/speech-writer"
import type { DebateMessage, JudgmentData, RoundArgument, RoundPlan } from "../backend/types"

export interface BuildRoundDebriefInputOptions {
  topic?: string
  userStance?: string
  botName?: string
  /**
   * The room transcript. The user's lines are quoted as their speeches and the
   * opponent's lines as the opponent's; the judge's are left out.
   */
  transcript?: DebateMessage[]
  /** The setup wizard's round plan: each side's chosen arguments are listed for the coach. */
  plan?: RoundPlan
}

/** The four judged phases, in round order, with the titles the scorecard shows. */
const PHASES = [
  ["opening_statement", "Opening Statement"],
  ["cross_examination", "Cross Examination"],
  ["answers", "Answers to Cross Examination"],
  ["closing", "Closing Statement"],
] as const

/**
 * Who said a transcript line, for the debrief: the user (`"User"`), the
 * judge (`"Judge"`, never quoted), or else the opponent — `"Bot"` or a
 * persona's own name, which a transcript may use instead.
 */
function speakerOf(message: DebateMessage): "user" | "judge" | "opponent" {
  if (message.sender === "User") return "user"
  if (message.sender === "Judge") return "judge"
  return "opponent"
}

/**
 * Builds the debrief input from a user-vs-bot judgment. The user's scores and
 * the judge's reasons for both sides are kept; the user's transcript lines
 * become `userSpeeches` and the opponent's become `opponentSpeeches`, each in
 * round order. Blank lines are dropped. With a `plan`, each side's chosen
 * arguments (title and summary) are passed too.
 */
export function buildRoundDebriefInput(
  judgment: JudgmentData,
  options: BuildRoundDebriefInputOptions = {},
): RoundDebriefInput {
  return {
    topic: options.topic,
    userStance: options.userStance,
    opponentName: options.botName,
    phases: PHASES.map(([key, title]) => ({
      title,
      userScore: judgment[key].user.score,
      opponentScore: judgment[key].bot.score,
      userReason: judgment[key].user.reason,
      opponentReason: judgment[key].bot.reason,
    })),
    verdict: { winner: judgment.verdict.winner, reason: judgment.verdict.reason },
    userSpeeches: speechesBy(options.transcript, "user"),
    opponentSpeeches: speechesBy(options.transcript, "opponent"),
    ...(options.plan
      ? {
          userArguments: argumentsOf(options.plan.userArguments),
          opponentArguments: argumentsOf(options.plan.botArguments),
        }
      : {}),
  }
}

/** A plan's arguments as the debrief lists them; a malformed list or entry is skipped. */
function argumentsOf(list: RoundArgument[] | undefined) {
  return (Array.isArray(list) ? list : [])
    .filter((arg) => typeof arg?.title === "string" && arg.title.trim())
    .map((arg) => ({ title: arg.title, ...(typeof arg.summary === "string" ? { summary: arg.summary } : {}) }))
}

function speechesBy(transcript: DebateMessage[] | undefined, speaker: "user" | "opponent") {
  return (transcript ?? [])
    .filter((message) => speakerOf(message) === speaker && typeof message.text === "string" && message.text.trim())
    .map((message) => ({ phase: message.phase, text: message.text }))
}
