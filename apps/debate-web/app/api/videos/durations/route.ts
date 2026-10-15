import { NextResponse, type NextRequest } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getVideoDurations, MAX_DURATION_IDS } from "@/lib/videos/backfill-video-durations";

/**
 * Lengths of the videos currently on screen, in seconds.
 *
 * Durations live in their own `video_durations` table (filled by the admin
 * backfill) rather than on the feed rows, so the grid and list views look the
 * loaded ids up here and show each one under the video's action buttons.
 *
 * Query parameters:
 * - `ids` — comma-separated YouTube ids, at most {@link MAX_DURATION_IDS}
 *
 * Responds `{ durations: Record<videoId, seconds> }`; an id with no stored
 * duration is omitted.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_DURATION_IDS);

  if (ids.length === 0) {
    return NextResponse.json({ durations: {} });
  }

  try {
    const db = await getDBFromContext();
    return NextResponse.json(
      { durations: await getVideoDurations(db, ids) },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    console.error("Failed to load video durations", error);
    return NextResponse.json({ error: "Failed to load video durations" }, { status: 500 });
  }
}
