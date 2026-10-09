import { NextResponse, type NextRequest } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import {
  createLibraryVideo,
  listLibraryVideos,
  type LibraryVideoPatch,
} from "@/lib/videos/admin-library";

/** A YouTube video id: 11 URL-safe base64 characters. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Searchable listing of every *published* video, for the admin library table.
 *
 * Distinct from `/api/admin/youtube/videos`, which pages the resync queue of
 * rounds still waiting to be published. This one reads the public `videos`
 * table, so an admin can find and fix a video that already went live.
 *
 * Query parameters: `q`, `style`, `source`, `transcript` (`with` / `without`),
 * `sort`, `dir`, `page`, `limit`.
 */
export async function GET(req: NextRequest) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const styleParam = Number(searchParams.get("style"));

  try {
    const db = await getDBFromContext();
    const page = await listLibraryVideos(db, {
      q: searchParams.get("q"),
      style: searchParams.get("style") && Number.isFinite(styleParam) ? styleParam : null,
      source: searchParams.get("source"),
      transcript: searchParams.get("transcript"),
      sort: searchParams.get("sort"),
      dir: searchParams.get("dir") === "asc" ? "asc" : "desc",
      page: Number(searchParams.get("page")) || 1,
      limit: Number(searchParams.get("limit")) || undefined,
    });
    return NextResponse.json(page);
  } catch (error) {
    console.error("Failed to list library videos:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to load videos", details: describeError(error) },
      { status: 500 },
    );
  }
}

/**
 * Adds a video to the library by hand — the admin "Add video" form.
 *
 * Body: `{ videoId, ...fields }`, the fields in the same shape the edit
 * PATCH takes. 409 when the id is already in the library, so an add can't
 * silently overwrite a published row (that's what editing is for).
 */
export async function POST(req: NextRequest) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: LibraryVideoPatch & { videoId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const { videoId, ...patch } = body;
  if (typeof videoId !== "string" || !VIDEO_ID.test(videoId)) {
    return NextResponse.json({ error: "`videoId` must be a YouTube video id" }, { status: 400 });
  }

  try {
    const db = await getDBFromContext();
    const result = await createLibraryVideo(db, videoId, patch);
    if (!result.ok) {
      return result.reason === "exists"
        ? NextResponse.json({ error: "That video is already in the library — edit it instead." }, { status: 409 })
        : NextResponse.json({ error: "A title is required." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, video: result.video }, { status: 201 });
  } catch (error) {
    console.error("Failed to add library video:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to add video", details: describeError(error) },
      { status: 500 },
    );
  }
}
