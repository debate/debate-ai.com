import { NextResponse, type NextRequest } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { listUnavailableVideos, markVideoAvailable } from "@/lib/videos/resync-view-counts";

/**
 * The videos YouTube no longer serves — deleted, made private, or with
 * embedding turned off.
 *
 * The weekly view-count resync asks the API about every stored id and records
 * what it finds; this is the read side of that, so takedowns are something an
 * admin can see and act on rather than something a viewer discovers by
 * clicking a card that plays nothing.
 */

/** YouTube ids are exactly 11 characters from this alphabet. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export async function GET(req: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit")) || 100, 1), 500);

  try {
    const db = await getDBFromContext();
    return NextResponse.json({ videos: await listUnavailableVideos(db, limit) });
  } catch (error) {
    console.error("Failed to list unavailable videos:", error);
    return NextResponse.json(
      { error: "Failed to load unavailable videos", details: (error as Error).message },
      { status: 500 },
    );
  }
}

/**
 * Clears one video's takedown flag.
 *
 * A private upload can be made public again and an embed restriction can be
 * lifted, so an admin who has checked should not have to wait a week for the
 * next run to clear the badge.
 */
export async function POST(req: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: { videoId?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const videoId = String(payload?.videoId ?? "").trim();
  if (!VIDEO_ID_RE.test(videoId)) {
    return NextResponse.json({ error: "videoId must be a YouTube video id" }, { status: 400 });
  }

  try {
    const db = await getDBFromContext();
    await markVideoAvailable(db, videoId);
    return NextResponse.json({ ok: true, videoId });
  } catch (error) {
    console.error("Failed to clear video availability flag:", error);
    return NextResponse.json(
      { error: "Failed to update video", details: (error as Error).message },
      { status: 500 },
    );
  }
}
