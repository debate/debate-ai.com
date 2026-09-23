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

/**
 * Reads one published video's row, for the watch page's "Edit video" dialog.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    const video = await updateLibraryVideo(db, id, patch);
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, video });
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
