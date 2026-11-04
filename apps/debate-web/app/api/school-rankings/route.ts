import { NextResponse, type NextRequest } from "next/server";
import { currentRankingSeasonYear } from "@debate-ai/rankings";
import { hasSchoolRankingsSeason } from "@debate-ai/rankings/src/leaderboard/schoolRankingsSnapshot";
import { getDBFromContext } from "@/lib/database/context";
import { getSchoolRankings } from "@/lib/rankings/school-rankings-store";

/**
 * @fileoverview The precomputed Schools table for one season
 * (`?season=2026`, default the current one), from D1
 * (`lib/rankings/school-rankings-store.ts`). The daily cron keeps the current
 * season fresh; the first request for a season builds and saves it.
 *
 * With `?hash=` matching the saved snapshot it answers `{ unchanged: true }`,
 * so the browser's daily revalidation of its own copy costs a few bytes.
 *
 * @module app/api/school-rankings/route
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const seasonParam = params.get("season");
  const seasonYear = seasonParam ? Number(seasonParam) : currentRankingSeasonYear();
  if (!Number.isInteger(seasonYear) || !hasSchoolRankingsSeason(seasonYear)) {
    return NextResponse.json({ error: "No school rankings for that season" }, { status: 404 });
  }

  try {
    const db = await getDBFromContext();
    const snapshot = await getSchoolRankings(db, seasonYear);
    const headers = { "Cache-Control": "public, max-age=300, s-maxage=300" };
    if (params.get("hash") === snapshot.hash) {
      return NextResponse.json({ unchanged: true, hash: snapshot.hash }, { headers });
    }
    return NextResponse.json(snapshot, { headers });
  } catch (error) {
    console.error("[school-rankings] could not serve", seasonYear, error);
    return NextResponse.json(
      { error: "School rankings are unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
