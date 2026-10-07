/**
 * @fileoverview Pure rules for the judge's "Tell the debater to be more
 * clear" request in a live round.
 *
 * A judge picks the item from a speech timer's ⋮ menu; the request rides the
 * round's existing room WebSocket (`webcam/room-protocol.ts`'s
 * `clarity-request` room event, the same channel `timer-sync` uses) to every
 * device in the room. Each device then decides on its own whether it is the
 * one giving that speech, and only that device shows the toast — see
 * `hooks/useClarityRequests.tsx` for the wiring.
 *
 * @module round/clarity-request
 */

import type { Round } from "../types/flow"
import { findViewerSeat, isViewerSpeech, type SpeakerSpeech } from "./my-speeches"

/** The menu item the judge sees next to each speech timer. */
export const CLARITY_REQUEST_LABEL = "Tell the debater to be more clear"

/** The toast the speaker sees. */
export const CLARITY_REQUEST_MESSAGE = "The judge has requested you be more clear."

/** A judge can send at most one request per speech in this window. */
export const CLARITY_REQUEST_COOLDOWN_MS = 5000

/** What travels over the room for one request. */
export interface ClarityRequestPayload {
  speechName: string
  /** Sender's clock when the request left; also dedupes the same request arriving on two sockets. */
  sentAt: number
}

const normalize = (email: string | null | undefined) => (email ?? "").trim().toLowerCase()

/** Whether one of the viewer's emails is recorded as a judge on the round. */
export function isRoundJudge(
  round: Round | null | undefined,
  viewerEmails: readonly (string | null | undefined)[],
): boolean {
  if (!round?.judges?.length) return false
  const mine = new Set(viewerEmails.map(normalize).filter(Boolean))
  return round.judges.some((judge) => mine.has(normalize(judge)))
}

/** Validates a room payload; null for anything malformed. */
export function parseClarityRequest(payload: unknown): ClarityRequestPayload | null {
  if (!payload || typeof payload !== "object") return null
  const { speechName, sentAt } = payload as Record<string, unknown>
  if (typeof speechName !== "string" || !speechName.trim() || speechName.length > 64) return null
  return { speechName, sentAt: typeof sentAt === "number" && Number.isFinite(sentAt) ? sentAt : 0 }
}

/**
 * Whether this device should show the toast for a request about `speech`.
 *
 * A debater seated on the round (their email is in `round.debaters`) gets it
 * when they give that speech. A device whose viewer isn't seated — the round
 * has no emails recorded, or they're signed in under another address — falls
 * back to "my timer for that speech is running", since the speaker's laptop
 * is the one running their speech clock. Judges never get it.
 */
export function shouldShowClarityRequest({
  round,
  viewerEmails,
  speech,
  speechTimerRunning,
}: {
  round: Round | null | undefined
  viewerEmails: readonly (string | null | undefined)[]
  speech: SpeakerSpeech | null | undefined
  speechTimerRunning: boolean
}): boolean {
  if (isRoundJudge(round, viewerEmails)) return false
  const seat = findViewerSeat(round, viewerEmails)
  if (seat) return !!speech && isViewerSpeech(speech, seat)
  return speechTimerRunning
}

/** Sender-side rate limit: true (and records the send) when `speechName` is off cooldown. */
export function takeClarityRequestSlot(
  lastSent: Map<string, number>,
  speechName: string,
  now: number,
  cooldownMs = CLARITY_REQUEST_COOLDOWN_MS,
): boolean {
  const last = lastSent.get(speechName)
  if (last !== undefined && now - last < cooldownMs) return false
  lastSent.set(speechName, now)
  return true
}
