import { NextResponse, type NextRequest } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getSchoolDirectoryEntry } from "@/lib/rankings/school-directory-store";

/**
 * `GET /api/rankings/school-directory?handle=<handle>`: one school from the
 * school directory (every college and high school of the last ten seasons,
 * rebuilt daily; `lib/rankings/school-directory-store.ts`), or
 * `{ school: null }`. A school page that no current ranking lists uses it
 * for the school's name, level and other names. An old spelling's handle
 * (`state-university-of-new-york-binghamton`) finds the school's row.
 */

const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";

export async function GET(req: NextRequest) {
  const handle = (req.nextUrl.searchParams.get("handle") ?? "").trim().toLowerCase();
  if (!handle || handle.length > 160 || !/^[a-z0-9-]+$/.test(handle)) {
    return NextResponse.json({ error: "Missing handle" }, { status: 400 });
  }
  const db = await getDBFromContext().catch(() => null);
  if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const school = await getSchoolDirectoryEntry(db, handle);
    return NextResponse.json({ school }, { headers: { "Cache-Control": CACHE } });
  } catch (error) {
    console.error("[school-directory] failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "School directory unavailable" }, { status: 502 });
  }
}
