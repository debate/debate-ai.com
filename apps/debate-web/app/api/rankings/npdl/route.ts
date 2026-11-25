import { NextResponse, type NextRequest } from "next/server";
import { NPDL_SEASONS, type NpdlSeasonRankings } from "@debate-ai/rankings/src/sync/sync-npdl-rankings";
import npdlSnapshot from "@debate-ai/rankings/data/npdl-rankings.json";
import { getDBFromContext } from "@/lib/database/context";
import { getNpdlRankings } from "@/lib/rankings/npdl-rankings-store";

const snapshot = npdlSnapshot as Record<string, NpdlSeasonRankings>;

/**
 * NPDL (high school parliamentary) national rankings for one season, read
 * from D1 (`lib/rankings/npdl-rankings-store.ts`).
 *
 * `?season=2024-25` picks a season; without it the newest saved season with
 * rows is returned. The daily cron keeps the newest seasons current; this
 * route only scrapes parliamentarydebate.org when a season was never saved,
 * then saves it. When D1 cannot be read, the bundled snapshot
 * (`bun run sync-npdl`) is served with a short cache, and `rankings: null`
 * when it has nothing either.
 */
export async function GET(request: NextRequest) {
  const asked = request.nextUrl.searchParams.get("season");
  if (asked && !NPDL_SEASONS.includes(asked)) {
    return NextResponse.json({ error: "unknown season" }, { status: 400 });
  }

  try {
    const { rankings, source } = await getNpdlRankings(await getDBFromContext(), asked);
    if (rankings) {
      return NextResponse.json(
        { source, seasons: NPDL_SEASONS, rankings },
        { headers: { "Cache-Control": "public, max-age=1800, s-maxage=3600" } },
      );
    }
  } catch (error) {
    console.error("[npdl-rankings] D1 read failed:", error instanceof Error ? error.message : String(error));
  }

  const fallback = asked ? snapshot[asked] : NPDL_SEASONS.map((s) => snapshot[s]).find(Boolean);
  return NextResponse.json(
    { source: "snapshot", seasons: NPDL_SEASONS, rankings: fallback ?? null },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
