import { NextResponse, type NextRequest } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { eq } from "drizzle-orm";
import { getDBFromContext } from "@/lib/database/context";
import { videos } from "@/lib/database/schema";
import { describeError } from "@/lib/database/errors";
import {
  deleteLibraryVideo,
  updateLibraryVideo,
  type LibraryVideoPatch,
} from "@/lib/videos/admin-library";
import { getVideoById } from "@/lib/videos/video-repository";
import { videoRouteHref, type VideoType } from "@debate-ai/videos";

/**
 * Reads one published video's row, for the watch page's edit dialog.
 *
 * Open to everyone: the row is the public library's own record, and viewers
 * open the same dialog to suggest a change (filed to `/api/video-issues` for
 * a moderator to approve). Writing stays staff-only below.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const db = await getDBFromContext();
    const [video] = await db.select().from(videos).where(eq(videos.videoId, id)).limit(1);
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    return NextResponse.json({ video });
  } catch (error) {
    console.error("Failed to read library video:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to read video", details: describeError(error) },
      { status: 500 },
    );
  }
}

/**
 * The video's canonical watch-page path, or `null` when it can't be built
 * (the video isn't in the public feed). Never throws: the path is a
 * convenience for the edit dialog, not part of the save.
 */
async function watchPageHref(videoId: string): Promise<string | null> {
  try {
    const video = await getVideoById(videoId);
    return video ? videoRouteHref(video as unknown as VideoType) : null;
  } catch (error) {
    console.warn("Could not build the watch-page path:", describeError(error));
    return null;
  }
}

/**
 * Edits one published video's metadata.
 *
 * The body is a partial row — only the fields it carries are written, and the
 * derived columns the public feed sorts and searches on are recomputed from
 * the result (see `lib/videos/admin-library.ts`).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let patch: LibraryVideoPatch;
  try {
    patch = (await req.json()) as LibraryVideoPatch;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return NextResponse.json({ error: "Body must be an object of fields to update" }, { status: 400 });
  }

  try {
    const db = await getDBFromContext();
    const previousHref = await watchPageHref(id);
    const video = await updateLibraryVideo(db, id, patch);
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    // The watch page's address is derived from the title, tournament, round
    // and teams, so an edit can move it. Both paths go back so the page the
    // edit was made from can follow the video to its new address.
    const href = await watchPageHref(id);
    return NextResponse.json({ ok: true, video, href, previousHref });
  } catch (error) {
    console.error("Failed to update library video:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to update video", details: describeError(error) },
      { status: 500 },
    );
  }
}

/**
 * Removes one published video from the library, and records the removal so a
 * later YouTube resync does not re-publish it.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { canEditContent, email } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const db = await getDBFromContext();
    const removed = await deleteLibraryVideo(db, id, email);
    if (!removed) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("Failed to delete library video:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to delete video", details: describeError(error) },
      { status: 500 },
    );
  }
}
