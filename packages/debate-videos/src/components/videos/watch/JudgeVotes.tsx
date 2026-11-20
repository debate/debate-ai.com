"use client"

/**
 * @fileoverview A round's judges, each colored by the side they voted for:
 * the winner's color for the majority, the loser's for a judge who squirreled
 * (marked with an asterisk, as College Debate Results writes elim panels).
 * @module components/videos/watch/JudgeVotes
 */

import { cn } from "../../../ui/lib/utils"

export interface JudgeVote {
  name: string
  /** Voted with the minority. */
  squirreled: boolean
  /** The side this judge voted for; null when the winner is unknown. */
  side: "aff" | "neg" | null
}

const splitNames = (list: string | null | undefined): string[] =>
  (list ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

/**
 * Who voted which way. `judges` may already star its squirrels
 * ("A, B*, C"); `squirrels` names them separately. With a known winner the
 * majority voted for it and each squirrel for the other side.
 */
export function judgeVotes(
  judges: string | null | undefined,
  squirrels: string | null | undefined,
  affWin: boolean | null | undefined,
): JudgeVote[] {
  const minority = new Set(splitNames(squirrels).map((name) => name.toLowerCase()))
  const winner = typeof affWin === "boolean" ? (affWin ? "aff" : "neg") : null
  const loser = winner === "aff" ? "neg" : winner === "neg" ? "aff" : null
  return splitNames(judges).map((entry) => {
    const name = entry.replace(/\*+$/, "").trim()
    const squirreled = entry.endsWith("*") || minority.has(name.toLowerCase())
    return { name, squirreled, side: squirreled ? loser : winner }
  })
}

export const SIDE_TEXT = {
  aff: "text-blue-700 dark:text-blue-300",
  neg: "text-red-700 dark:text-red-300",
} as const

interface JudgeVotesProps {
  judges: string | null | undefined
  squirrels?: string | null
  affWin: boolean | null | undefined
  className?: string
}

/** "Judges: Jacob Wilkus, Cade Blenden*, AJ Byrne" with each name in its vote's color. */
export function JudgeVotes({ judges, squirrels, affWin, className }: JudgeVotesProps) {
  const votes = judgeVotes(judges, squirrels, affWin)
  if (votes.length === 0) return null
  return (
    <span className={className} data-testid="judge-votes">
      Judges:{" "}
      {votes.map((vote, index) => (
        <span key={`${vote.name}-${index}`}>
          {index > 0 && ", "}
          <span
            className={cn("font-medium", vote.side && SIDE_TEXT[vote.side])}
            data-side={vote.side ?? undefined}
            title={
              vote.side
                ? `Voted ${vote.side === "aff" ? "Aff" : "Neg"}${vote.squirreled ? " (squirreled)" : ""}`
                : vote.squirreled
                  ? "Squirreled"
                  : undefined
            }
          >
            {vote.name}
            {vote.squirreled ? "*" : ""}
          </span>
        </span>
      ))}
    </span>
  )
}
