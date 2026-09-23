import { NextResponse, type NextRequest } from "next/server";
import { VIDEO_RELATION_KINDS } from "debate-videos";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import {
  addVideoRelation,
  listVideoRelations,
  removeVideoRelation,
  reorderVideoRelations,
} from "@/lib/videos/video-content";

/**
 * The videos an editor has tied to one video — a round and the analysis
 * videos made about it, most of the time.
 *
 * Separate from `videos.stack_key`, which the YouTube sync derives from the
 * links descriptions happen to carry: these are stated here, survive a
 * re-seed, and have a direction. `video_id` is the video being watched and
 * `related_video_id` is what is offered beside it.
 */

/** YouTube ids are exactly 11 characters from this alphabet. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Narrows a relation to one the UI knows how to label. */
function isRelation(value: unknown): value is (typeof VIDEO_RELATION_KINDS)[number] {
  return typeof value === "string" && (VIDEO_RELATION_KINDS as readonly string[]).includes(value);
}

/** Lists this video's links, including any whose target has since been removed. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const db = await getDBFromContext();
    return NextResponse.json({ relations: await listVideoRelations(db, id) });
  } catch (error) {
    console.error("Failed to list video relations:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to load related videos", details: describeError(error) },
      { status: 500 },
    );
  }
}

/** Links another video to this one. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { canEditContent, email } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let payload: { relatedVideoId?: unknown; relation?: unknown; note?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const relatedVideoId = String(payload?.relatedVideoId ?? "").trim();
  if (!VIDEO_ID_RE.test(relatedVideoId)) {
    return NextResponse.json({ error: "relatedVideoId must be a YouTube video id" }, { status: 400 });
  }
  if (relatedVideoId === id) {
    return NextResponse.json({ error: "A video cannot be linked to itself" }, { status: 400 });
  }

  const relation = isRelation(payload?.relation) ? payload.relation : "analysis";
  const note = typeof payload?.note === "string" && payload.note.trim() ? payload.note.trim() : null;

  try {
    const db = await getDBFromContext();
    const link = await addVideoRelation(db, id, relatedVideoId, relation, note, email);
    return NextResponse.json({ ok: true, relation: link });
  } catch (error) {
    console.error("Failed to link videos:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to link videos", details: describeError(error) },
      { status: 500 },
    );
  }
}

/** Reorders this video's links to the sequence of ids in the body. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let payload: { order?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const order = Array.isArray(payload?.order)
    ? payload.order.filter((value): value is string => typeof value === "string")
    : null;
  if (!order) {
    return NextResponse.json({ error: "order must be an array of video ids" }, { status: 400 });
  }

  try {
    const db = await getDBFromContext();
    await reorderVideoRelations(db, id, order);
    return NextResponse.json({ ok: true, relations: await listVideoRelations(db, id) });
  } catch (error) {
    console.error("Failed to reorder video relations:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to reorder related videos", details: describeError(error) },
      { status: 500 },
    );
  }
}

/** Removes one link — `?relatedVideoId=…&relation=analysis`. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const relatedVideoId = searchParams.get("relatedVideoId") ?? "";
  const relation = searchParams.get("relation") ?? "analysis";

  if (!VIDEO_ID_RE.test(relatedVideoId)) {
    return NextResponse.json({ error: "relatedVideoId must be a YouTube video id" }, { status: 400 });
  }

  try {
    const db = await getDBFromContext();
    const removed = await removeVideoRelation(db, id, relatedVideoId, relation);
    if (!removed) {
      return NextResponse.json({ error: "No such link" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, relatedVideoId, relation });
  } catch (error) {
    console.error("Failed to unlink videos:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to unlink videos", details: describeError(error) },
      { status: 500 },
    );
  }
}
