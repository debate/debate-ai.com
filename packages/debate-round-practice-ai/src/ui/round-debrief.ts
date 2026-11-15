/**
 * @fileoverview Turns a finished Practice vs AI round (the judge's user-vs-bot
 * scorecard plus the room transcript) into the input for
 * `@debate-ai/speech-writer`'s Coach debrief prompt. Pure, so the mapping is
 * tested without rendering the scorecard.
 *
 * @module ui/round-debrief
 */

import type { RoundDebriefInput } from "@debate-ai/speech-writer"
import type { DebateMessage, JudgmentData } from "../backend/types"

export interface BuildRoundDebriefInputOptions {
  topic?: string
  userStance?: string
  botName?: string
  /** The room transcript. Only the user's own lines are quoted. */
  transcript?: DebateMessage[]
}

/** The four judged phases, in round order, with the titles the scorecard shows. */
const PHASES = [
  ["opening_statement", "Opening Statement"],
  ["cross_examination", "Cross Examination"],
  ["answers", "Answers to Cross Examination"],
  ["closing", "Closing Statement"],
] as const

/**
 * Builds the debrief input from a user-vs-bot judgment. The user's scores and
 * the judge's reasons for both sides are kept; only the transcript lines the
 * user sent (`sender: "User"`) are quoted.
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
    userSpeeches: (options.transcript ?? [])
      .filter((message) => message.sender === "User")
      .map((message) => ({ phase: message.phase, text: message.text })),
  }
}
