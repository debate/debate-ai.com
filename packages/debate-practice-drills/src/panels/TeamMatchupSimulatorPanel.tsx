/**
 * @fileoverview Ranked-team matchup simulator on the practice-round page.
 *
 * Composes `debate-videos`' `MatchupSimulator` (which owns the rankings UI)
 * rather than re-implementing it: pick any two teams from a division's
 * full-season rankings and see their Glicko-2 head-to-head odds. The same
 * simulator sits on every team profile with that team locked in.
 */

"use client"

import { MatchupSimulator } from "@debate/videos"

/** Practice-round section: simulate a round between any two ranked teams. */
export function TeamMatchupSimulatorPanel() {
  return <MatchupSimulator title="Simulate a round between ranked teams" />
}
