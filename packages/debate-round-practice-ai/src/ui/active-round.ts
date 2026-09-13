/**
 * @fileoverview Resume state for an in-progress Practice vs AI round.
 *
 * `DebateRoom` already keeps its own transcript in a
 * `debate_${userId}_${topic}_${debateId}` localStorage key, restored
 * whenever it mounts with matching props. But `DebatePracticeVsAi` only ever
 * learned which round to mount from its own React state, which a hard
 * reload discards — so the round screen always fell back to the picker,
 * even though the transcript itself was still sitting in localStorage. This
 * module gives the parent the one thing it was missing: which round (if
 * any) is in progress, so it can hand `DebateRoom` the same props the round
 * started with and let that component's own resume logic take it from
 * there.
 *
 * @module ui/active-round
 */

import type { StartedDebate } from "./BotSelection"

function activeRoundKey(userId: string | undefined): string {
  return `practiceVsAiActiveRound_${userId ?? "guest"}`
}

function isPhaseTiming(value: unknown): value is { name: string; time: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string" &&
    typeof (value as { time?: unknown }).time === "number"
  )
}

function isStartedDebate(value: unknown): value is StartedDebate {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<StartedDebate>
  return (
    typeof candidate.debateId === "string" &&
    typeof candidate.botName === "string" &&
    typeof candidate.botLevel === "string" &&
    typeof candidate.topic === "string" &&
    typeof candidate.stance === "string" &&
    Array.isArray(candidate.phaseTimings) &&
    candidate.phaseTimings.every(isPhaseTiming)
  )
}

/** The in-progress round for this user, if a valid one was saved. */
export function readActiveRound(userId: string | undefined): StartedDebate | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(activeRoundKey(userId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    return isStartedDebate(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Record that a round has started, so a reload resumes it instead of the picker. */
export function writeActiveRound(userId: string | undefined, debate: StartedDebate): void {
  if (typeof window === "undefined") return
  localStorage.setItem(activeRoundKey(userId), JSON.stringify(debate))
}

/** Clear the in-progress round once it's over (judged, conceded, or exited). */
export function clearActiveRound(userId: string | undefined): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(activeRoundKey(userId))
}
