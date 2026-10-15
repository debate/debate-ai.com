/**
 * @fileoverview Opens the site's own markets — each division's top five on a
 * monthly rating market, and a winner market for every major tournament still
 * ahead — whichever of them aren't open yet. The plan itself is
 * `planPresetMarkets` in `@debate/predictions`; this reads the rankings and
 * writes the missing rows.
 *
 * Runs on board reads. A plan only changes when the month turns, a
 * tournament starts or a deploy ships new rankings, so an isolate that has
 * seeded recently skips the check.
 *
 * @module lib/predictions/presets
 */

import { inArray } from "drizzle-orm";
import { PRESET_DIVISIONS, planPresetMarkets, type PresetRankings } from "@debate/predictions";

import type { getDBFromContext } from "@/lib/database/context";
import { predictionMarkets } from "@/lib/database/schema";
import { insertMarket } from "./queries";
import { rankedTeams } from "./ratings";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** How long an isolate trusts its last seeding before checking again. */
const RESEED_AFTER_SECONDS = 10 * 60;

let lastSeeded = 0;

/** Reads each preset division's rankings; a division that fails to load is skipped. */
export async function loadPresetRankings(): Promise<PresetRankings[]> {
  const loaded = await Promise.allSettled(
    PRESET_DIVISIONS.map(async (division) => ({ dataset: division.dataset, teams: await rankedTeams(division.dataset) })),
  );
  return loaded.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

/**
 * Inserts every planned preset market that doesn't exist yet. Returns how
 * many it opened. A market that settled or was voided keeps its id, so it is
 * never reopened.
 */
export async function seedPresetMarkets(
  db: Db,
  now: number,
  loadRankings: () => Promise<PresetRankings[]> = loadPresetRankings,
): Promise<number> {
  if (now - lastSeeded < RESEED_AFTER_SECONDS) return 0;
  const planned = planPresetMarkets(now, await loadRankings());
  if (planned.length === 0) return 0;

  const existing = await db
    .select({ id: predictionMarkets.id })
    .from(predictionMarkets)
    .where(inArray(predictionMarkets.id, planned.map((market) => market.id)));
  const have = new Set(existing.map((row: { id: string }) => row.id));

  let opened = 0;
  for (const market of planned) {
    if (have.has(market.id)) continue;
    try {
      await insertMarket(db, { ...market, creatorId: null });
      opened += 1;
    } catch {
      // Another request opened it first.
    }
  }
  lastSeeded = now;
  return opened;
}

/** Forgets the last seeding, for tests. */
export function resetPresetSeeding(): void {
  lastSeeded = 0;
}
