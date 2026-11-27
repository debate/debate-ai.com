import { NextResponse, type NextRequest } from "next/server";
import { NPDL_SEASONS, type NpdlSeasonRankings } from "@debate-ai/rankings/src/sync/sync-npdl-rankings";
import npdlSnapshot from "@debate-ai/rankings/data/npdl-rankings.json";
import { getDBFromContext } from "@/lib/database/context";
import { getNpdlRankings } from "@/lib/rankings/npdl-rankings-store";

const snapshot = npdlSnapshot as Record<string, NpdlSeasonRankings>;

const hasRows = (r: NpdlSeasonRankings | null | undefined): r is NpdlSeasonRankings =>
  Boolean(r && (r.teams.length > 0 || r.schools.length > 0));

/** Position in {@link NPDL_SEASONS} (newest first); lower is newer. */
const seasonAge = (season: string) => NPDL_SEASONS.indexOf(season);

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * NPDL (high school parliamentary) national rankings for one season, read
 * from D1 (`lib/rankings/npdl-rankings-store.ts`).
 *
 * `?season=2024-25` picks a season; without it the newest season with rows is
 * returned. The daily cron keeps the newest seasons current; this route only
 * scrapes parliamentarydebate.org when a season was never saved, then saves
 * it. When D1 cannot be read or has nothing for the season, the bundled
 * snapshot (`bun run sync-npdl`) is served with a short cache, and
 * `rankings: null` (never cached) when it has nothing either.
 */
export async function GET(request: NextRequest) {
  const asked = request.nextUrl.searchParams.get("season");
  if (asked && !NPDL_SEASONS.includes(asked)) {
    return NextResponse.json({ error: "unknown season" }, { status: 400, headers: NO_STORE });
  }

  const fallback = asked ? snapshot[asked] : NPDL_SEASONS.map((s) => snapshot[s]).find(hasRows);
  try {
    const { rankings, source } = await getNpdlRankings(await getDBFromContext(), asked);
    // With no season asked, a snapshot season newer than anything D1 has saved wins.
    const stale = !asked && hasRows(fallback) && rankings && seasonAge(fallback.season) < seasonAge(rankings.season);
    if (hasRows(rankings) && !stale) {
      return NextResponse.json(
        { source, seasons: NPDL_SEASONS, rankings },
        { headers: { "Cache-Control": "public, max-age=1800, s-maxage=3600" } },
      );
    }
  } catch (error) {
    console.error("[npdl-rankings] D1 read failed:", error instanceof Error ? error.message : String(error));
  }

  return NextResponse.json(
    { source: "snapshot", seasons: NPDL_SEASONS, rankings: hasRows(fallback) ? fallback : null },
    { headers: hasRows(fallback) ? { "Cache-Control": "public, max-age=300, s-maxage=300" } : NO_STORE },
  );
}
