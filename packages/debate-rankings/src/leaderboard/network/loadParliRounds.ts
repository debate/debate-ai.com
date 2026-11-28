/**
 * @fileoverview Lazily loads the bundled Parli round snapshot
 * (`data/npdl-tabroom-rounds.json`, refreshed by `bun run sync-parli-rounds`)
 * so its chunk is fetched only when the Parli tab's "Who debated whom" card is
 * shown.
 * @module @debate-ai/rankings/leaderboard/network/loadParliRounds
 */

import type { ParliRoundsSeason } from "../../sync/parli-tabroom-rounds"

/** A season's synced Tabroom rounds, or `null` when none were synced for it. */
export async function loadParliRounds(season: string): Promise<ParliRoundsSeason | null> {
  const mod = (await import("../../../data/npdl-tabroom-rounds.json")) as unknown as {
    default?: Record<string, ParliRoundsSeason>
  } & Record<string, ParliRoundsSeason>
  const all = mod.default ?? mod
  return all[season] ?? null
}
