import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import {
  backfillVideoDurations,
  getVideoDurationStatus,
} from "@/lib/videos/backfill-video-durations";

/**
 * Fetches one page of video lengths from YouTube and stores them in
 * `video_durations`, across the published `videos` table and the admin round
 * queue.
 *
 * Body: `{ after?: string, limit?: number, refresh?: boolean }`. The admin
 * button calls this repeatedly, passing back `nextCursor` as `after`, until it
 * comes back `null`. Re-running is safe: rows are upserted by video id, and by
 * default only videos without a duration are fetched.
 */
export async function POST(request: Request) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    after?: unknown;
    limit?: unknown;
    refresh?: unknown;
  };

  try {
    const db = await getDBFromContext();
    const result = await backfillVideoDurations(db, {
      after: typeof body.after === "string" ? body.after : null,
      limit: typeof body.limit === "number" ? body.limit : undefined,
      refresh: body.refresh === true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error fetching video durations:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to fetch video durations", details: describeError(error) },
      { status: 500 },
    );
  }
}

/** Duration coverage and total running time, for the admin card. */
export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = await getDBFromContext();
    return NextResponse.json(await getVideoDurationStatus(db));
  } catch (error) {
    console.error("Error reading video duration status:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to read video duration status", details: describeError(error) },
      { status: 500 },
    );
  }
}
