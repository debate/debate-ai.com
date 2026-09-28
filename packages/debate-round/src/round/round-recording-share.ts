/**
 * @fileoverview Pure helper for collecting a round's participant emails, for
 * "Share with Opponents" on a speech's audio recording
 * (`debate-timer/src/recorder/SpeechRecordingPlayer.tsx`'s
 * `SpeechRecordingMenu#participantEmails`, wired from
 * `layout/SpeechControlsTopBar.tsx` → `panels/DebateRoundPanel.tsx`). That
 * menu item used to be a no-op — clicking it did nothing at all.
 *
 * Kept as its own small pure function here (rather than in `debate-timer`
 * alongside the menu) since `debate-timer` doesn't depend on `debate-round`
 * (the dependency runs the other way — `debate-round` depends on
 * `debate-timer` for `SpeechRecordingMenu` itself), so the emails have to be
 * resolved up here and passed down as a plain `string[]` prop. Same
 * collection shape as `round/round-invite-client.ts#computeAddedInviteEmails`
 * reads off (`Round.debaters.aff`/`.neg`, `Round.judges`, `Round.spectators`
 * — all populated with emails, not display names, by the Round Editor
 * dialog).
 *
 * @module round/round-recording-share
 */

import type { Round } from "../types/flow"

/**
 * Collects every debater/judge/spectator email recorded on a round, deduped
 * case-insensitively (first-seen casing kept), blank entries ignored,
 * missing fields tolerated. Returns `[]` for an undefined round.
 */
export function getRoundRecordingShareEmails(round: Round | undefined): string[] {
  if (!round) return []

  const candidates = [
    ...(round.debaters?.aff ?? []),
    ...(round.debaters?.neg ?? []),
    ...(round.judges ?? []),
    ...(round.spectators ?? []),
  ]

  const seen = new Set<string>()
  const emails: string[] = []
  for (const raw of candidates) {
    const trimmed = (raw ?? "").trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    emails.push(trimmed)
  }
  return emails
}
