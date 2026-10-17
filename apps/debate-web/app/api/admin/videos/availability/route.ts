import { NextResponse, type NextRequest } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import {
  countUnavailableVideos,
  deleteUnavailableVideos,
  listUnavailableVideos,
  markVideoAvailable,
  parseUnavailableStates,
} from "@/lib/videos/resync-view-counts";

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
    const [videos, counts] = await Promise.all([
      listUnavailableVideos(db, limit),
      countUnavailableVideos(db),
    ]);
    return NextResponse.json({ videos, counts });
  } catch (error) {
    console.error("Failed to list unavailable videos:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to load unavailable videos", details: describeError(error) },
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
    console.error("Failed to clear video availability flag:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to update video", details: describeError(error) },
      { status: 500 },
    );
  }
}

/**
 * Removes every published video flagged in the chosen takedown states — the
 * panel's "Remove unavailable videos" button.
 *
 * Takes `{ states: ["removed", "private", "not_embeddable"] }`; only the
 * states named are removed, so an admin can drop deleted uploads while keeping
 * private ones that may come back. Each removed id is excluded from future
 * YouTube syncs, the same as the library table's per-row Remove.
 */
export async function DELETE(req: NextRequest) {
  const { isAdmin, email } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: { states?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const states = parseUnavailableStates(payload?.states);
  if (states.length === 0) {
    return NextResponse.json(
      { error: "states must name at least one of removed, private, not_embeddable" },
      { status: 400 },
    );
  }

  try {
    const db = await getDBFromContext();
    const removed = await deleteUnavailableVideos(db, states, email);
    return NextResponse.json({ ok: true, removed: removed.length, videoIds: removed });
  } catch (error) {
    console.error("Failed to remove unavailable videos:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to remove videos", details: describeError(error) },
      { status: 500 },
    );
  }
}
