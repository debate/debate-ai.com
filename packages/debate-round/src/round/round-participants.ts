/**
 * @fileoverview Pure helper for collecting every email recorded on a debate
 * round — its debaters, judges and spectators (see `types/flow.ts`'s
 * `Round`; those three fields are populated with *emails*, not display
 * names, by the Round Editor dialog — see
 * `dialogs/CreateRoundDialog/useRoundEditorForm.ts`'s `dispatchRoundInvites`
 * call, which sends the exact same fields to `/api/rounds/invite`).
 *
 * `hooks/useSpeechHandlers.ts`'s "Share speech" action used to always pass
 * an empty participant list to `shareSpeech` (its own former "TODO: Get
 * actual participant emails from round data" comment), even though the
 * round those emails live on is one lookup away via the flow's own
 * `roundId` — so clicking "Share speech with round participants" never
 * actually notified anyone, while the UI still marked it "Shared". This
 * closes that gap.
 *
 * @module round/round-participants
 */

import type { Round } from "../types/flow";

/**
 * Every distinct, non-blank email recorded on a round — both debaters,
 * every judge, and every spectator — deduped case-insensitively while
 * keeping each email's first-seen casing. Returns an empty array for a
 * round missing an expected field, or when no round is passed at all (e.g.
 * a speech whose flow isn't attached to any round yet).
 */
export function getRoundParticipantEmails(round: Round | null | undefined): string[] {
  if (!round) return [];

  const candidates = [
    ...(round.debaters?.aff ?? []),
    ...(round.debaters?.neg ?? []),
    ...(round.judges ?? []),
    ...(round.spectators ?? []),
  ];

  const seen = new Set<string>();
  const emails: string[] = [];
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(trimmed);
  }
  return emails;
}
