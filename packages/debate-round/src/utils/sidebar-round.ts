/**
 * @fileoverview Which round the rounds sidebar shows its timers for.
 *
 * The app dock no longer carries a Timer shortcut, so the sidebar's round
 * group is the only round-timer surface: it follows the round the user has
 * selected rather than only ever tracking the live one. Kept out of
 * `FlowPageSidebar` so the rule can be unit-tested on its own.
 */

import type { Flow, Round } from "../types/flow"

/**
 * Picks the round whose timers the sidebar shows.
 *
 * @param rounds - Every round available in the session.
 * @param currentFlow - The flow tab currently selected, if any.
 * @returns The round the selected flow belongs to; failing that, the round
 *   currently in progress; failing that, `undefined` (no round group shown).
 */
export function selectSidebarRound(rounds: Round[], currentFlow: Flow | null | undefined): Round | undefined {
  const roundId = currentFlow?.roundId
  const selected = roundId != null ? rounds.find((r) => r.id === roundId) : undefined
  return selected ?? rounds.find((r) => r.status === "active")
}
