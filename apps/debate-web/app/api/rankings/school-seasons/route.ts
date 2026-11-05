import { NextResponse, type NextRequest } from "next/server";
import { schoolSeasonKey, type SchoolSeasonsResponse } from "@debate-ai/rankings";
import { getDBFromContext } from "@/lib/database/context";
import { getSchoolSeasons } from "@/lib/rankings/school-season-store";

/**
 * `GET /api/rankings/school-seasons?school=<handle>`: one high school's best
 * ranked entries per event for every finished season (2015-16 on), for the
 * school page's "Historical legend" chart.
 *
 * Seasons are built into D1 a few per request (`lib/rankings/school-season-store.ts`);
 * while any are still unbuilt the response says how many (`pending`) and is
 * not cached, and the page asks again. Ranks come precomputed (refreshed by
 * the daily cron and whenever a season is built); `failures` says which
 * seasons could not be built and why.
 */

const DONE_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";

export async function GET(req: NextRequest) {
  const school = schoolSeasonKey(req.nextUrl.searchParams.get("school") ?? "");
  if (!school || school.length > 160) {
    return NextResponse.json({ error: "Missing school" }, { status: 400 });
  }
  const db = await getDBFromContext().catch(() => null);
  if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { seasons, pending, ranks, failures } = await getSchoolSeasons(db, school);
    const body: SchoolSeasonsResponse = { school, seasons, pending, ranks, failures };
    return NextResponse.json(body, { headers: { "Cache-Control": pending ? "no-store" : DONE_CACHE } });
  } catch (error) {
    console.error("[school-seasons] failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "School seasons unavailable" }, { status: 502 });
  }
}
