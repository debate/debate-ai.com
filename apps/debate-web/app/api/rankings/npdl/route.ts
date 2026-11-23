import { NextResponse, type NextRequest } from "next/server";
import {
  fetchNpdlSeason,
  NPDL_SEASONS,
  type NpdlSeasonRankings,
} from "@debate-ai/rankings/src/sync/sync-npdl-rankings";
import npdlSnapshot from "@debate-ai/rankings/data/npdl-rankings.json";

const snapshot = npdlSnapshot as Record<string, NpdlSeasonRankings>;

/** How many seasons back an unspecified request tries before giving up. */
const DEFAULT_SEASON_TRIES = 3;

/**
 * NPDL (high school parliamentary) national rankings for one season, scraped
 * live from parliamentarydebate.org's embedded Google Sheets.
 *
 * `?season=2024-25` picks a season; without it the newest season that has
 * rows is returned (the coming season's page is often still empty). Live
 * results are edge-cached for six hours. When the site or Google cannot be
 * reached, the bundled snapshot (`bun run sync-npdl`) is served instead with a
 * short cache, and `season: null` when it has nothing either.
 */
export async function GET(request: NextRequest) {
  const asked = request.nextUrl.searchParams.get("season");
  if (asked && !NPDL_SEASONS.includes(asked)) {
    return NextResponse.json({ error: "unknown season" }, { status: 400 });
  }

  const candidates = asked ? [asked] : NPDL_SEASONS.slice(0, DEFAULT_SEASON_TRIES);
  for (const season of candidates) {
    try {
      const rankings = await fetchNpdlSeason(season, { retries: 2, timeoutMs: 15_000 });
      if (rankings.teams.length === 0 && rankings.schools.length === 0) continue;
      return NextResponse.json(
        { source: "live", seasons: NPDL_SEASONS, rankings },
        { headers: { "Cache-Control": "public, max-age=1800, s-maxage=21600" } },
      );
    } catch (error) {
      console.error(
        `[npdl-rankings] ${season} scrape failed:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const fallback = asked ? snapshot[asked] : NPDL_SEASONS.map((s) => snapshot[s]).find(Boolean);
  return NextResponse.json(
    { source: "snapshot", seasons: NPDL_SEASONS, rankings: fallback ?? null },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
