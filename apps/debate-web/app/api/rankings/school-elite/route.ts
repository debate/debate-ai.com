import { NextResponse, type NextRequest } from "next/server";
import { SCHOOL_SEASON_FORMATS, type SchoolSeasonEvent } from "@debate-ai/rankings";
import { getDBFromContext } from "@/lib/database/context";
import { getSchoolElite } from "@/lib/rankings/school-season-store";

/**
 * `GET /api/rankings/school-elite?event=Policy|Lincoln-Douglas|Public Forum`:
 * the high school "Elite 8" chart for one event on the Schools rankings tab,
 * the eight programs with the most all-time points in that event and where
 * each ranked season by season (`buildHsEliteSchools`).
 *
 * Built from the stored season rows (`lib/rankings/school-season-store.ts`);
 * while seasons are still unbuilt the response says how many (`pending`) and
 * is not cached.
 */

const DONE_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";

export async function GET(req: NextRequest) {
  const event = req.nextUrl.searchParams.get("event") ?? "";
  if (!SCHOOL_SEASON_FORMATS.some((f) => f.event === event)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }
  const db = await getDBFromContext().catch(() => null);
  if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const body = await getSchoolElite(db, event as SchoolSeasonEvent);
    return NextResponse.json(body, { headers: { "Cache-Control": body.pending ? "no-store" : DONE_CACHE } });
  } catch (error) {
    console.error("[school-elite] failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "School Elite 8 unavailable" }, { status: 502 });
  }
}
