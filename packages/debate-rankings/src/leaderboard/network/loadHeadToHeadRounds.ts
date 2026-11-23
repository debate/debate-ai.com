/// <reference path="../../raw.d.ts" />
/**
 * @fileoverview Lazily loads a format's round CSVs from the
 * `debate-rankings-sync-data` submodule for the head-to-head network.
 *
 * Like `upstream.ts`, the files are read by path with Vite's `?raw` suffix, so
 * each format is its own lazy chunk and bumping the submodule refreshes the
 * graph. A checkout without the submodule simply finds no files.
 * @module @debate-ai/rankings/leaderboard/network/loadHeadToHeadRounds
 */

import { getRankingDatasetInfo } from "../../upstream"
import type { RankingDatasetId } from "../../types"
import { parseTournamentRounds, type HeadToHeadRound, type TournamentCsvs } from "./headToHeadNetwork"

type GlobLoaders = Record<string, () => Promise<string>>

/** Folder under `tournaments/` each dataset reads; LD's Sep–Oct slice reads LD's. */
const FORMAT_DIR: Record<RankingDatasetId, "hspf" | "hsld" | "hscx" | "cpd"> = {
  hspf: "hspf",
  hsld: "hsld",
  hsld_sepoct: "hsld",
  hscx: "hscx",
  cpd: "cpd",
}

/** Literal globs, one per format, so the bundler can split them. */
const GLOBS: Record<(typeof FORMAT_DIR)[RankingDatasetId], () => GlobLoaders> = {
  hspf: () =>
    import.meta.glob("../../../../debate-rankings-sync-data/tournaments/hspf/*/*.csv", {
      query: "?raw",
      import: "default",
    }) as GlobLoaders,
  hsld: () =>
    import.meta.glob("../../../../debate-rankings-sync-data/tournaments/hsld/*/*.csv", {
      query: "?raw",
      import: "default",
    }) as GlobLoaders,
  hscx: () =>
    import.meta.glob("../../../../debate-rankings-sync-data/tournaments/hscx/*/*.csv", {
      query: "?raw",
      import: "default",
    }) as GlobLoaders,
  cpd: () =>
    import.meta.glob("../../../../debate-rankings-sync-data/tournaments/cpd/*/*.csv", {
      query: "?raw",
      import: "default",
    }) as GlobLoaders,
}

/**
 * Groups glob paths into tournament folders and reads them. Only the
 * dataset's own tournaments are read (LD's Sep–Oct slice stops at its topic
 * boundary).
 */
export async function readTournamentCsvs(loaders: GlobLoaders, tournaments?: readonly string[]): Promise<TournamentCsvs[]> {
  const folders = new Map<string, { entries?: () => Promise<string>; rounds: [string, () => Promise<string>][] }>()
  for (const [path, load] of Object.entries(loaders)) {
    const parts = path.split("/")
    const file = parts.at(-1) ?? ""
    const slug = parts.at(-2) ?? ""
    if (tournaments && !tournaments.includes(slug)) continue
    const folder = folders.get(slug) ?? { rounds: [] }
    if (file === "entries.csv") folder.entries = load
    else folder.rounds.push([file, load])
    folders.set(slug, folder)
  }
  const out = await Promise.all(
    [...folders].map(async ([slug, folder]) => {
      if (!folder.entries) return null
      const [entries, rounds] = await Promise.all([
        folder.entries(),
        Promise.all(folder.rounds.map(async ([file, load]) => ({ file, text: await load() }))),
      ])
      return { slug, entries, rounds } satisfies TournamentCsvs
    }),
  )
  return out.filter((t): t is TournamentCsvs => t !== null)
}

const cache = new Map<RankingDatasetId, Promise<HeadToHeadRound[]>>()

/** Every decided round of a dataset's tournaments, loaded once per dataset. */
export function loadHeadToHeadRounds(id: RankingDatasetId): Promise<HeadToHeadRound[]> {
  let promise = cache.get(id)
  if (!promise) {
    const dir = FORMAT_DIR[id]
    const tournaments = getRankingDatasetInfo(id)?.tournaments
    promise = readTournamentCsvs(GLOBS[dir](), tournaments).then((list) =>
      list.flatMap((t) => parseTournamentRounds(t, dir === "hsld")),
    )
    promise.catch(() => cache.delete(id))
    cache.set(id, promise)
  }
  return promise
}
