import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { ensureRoundVideosTable } from "@/lib/youtube/round-videos-table";
import { youtubeRoundVideos } from "@/lib/database/schema";
import { publishRoundVideos } from "@/lib/videos/publish-round-video";
import { deleteQueuedRoundVideo } from "@/lib/youtube/video-exclusions";

/**
 * Publishes one queued round video to the public `videos` table, then drops
 * it from the resync queue — matches the bulk `publish-all` route, scoped to
 * a single video for the admin page's per-row "Publish" action.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = await getDBFromContext();
  await ensureRoundVideosTable(db);

  const [row] = await db.select().from(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, id)).limit(1);
  if (!row) {
    return NextResponse.json({ error: "Video not found in queue" }, { status: 404 });
  }

  await publishRoundVideos(db, [row]);
  await db.delete(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, id));

  return NextResponse.json({ ok: true, id });
}

/**
 * Removes one video from the resync queue without publishing it, and records
 * it in `youtube_video_exclusions` so later channel scans never queue it again.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { canEditContent, email } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = await getDBFromContext();
  await ensureRoundVideosTable(db);

  await deleteQueuedRoundVideo(db, id, email ?? null);

  return NextResponse.json({ ok: true, id });
}

/**
 * Updates one queued video's editable metadata (title, channel, style,
 * lecture category, tournament, round level, teams, result). The edit dialog
 * on the admin queue page saves through this — a queued round isn't in the
 * public `videos` table yet, so the library's PATCH route can't touch it.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = await getDBFromContext();
  await ensureRoundVideosTable(db);

  const [row] = await db.select().from(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, id)).limit(1);
  if (!row) {
    return NextResponse.json({ error: "Video not found in queue" }, { status: 404 });
  }

  const body = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 });
  }

  // Only the fields the request sends change; an absent key leaves its
  // column alone. Keys are the Drizzle property names, not SQL columns.
  const updates: Record<string, unknown> = {};
  const has = (key: string) => Object.hasOwn(body, key);
  /** Optional text: blank or null clears it. */
  const setText = (key: string, column: string) => {
    if (!has(key)) return;
    const value = body[key];
    if (typeof value === "string") updates[column] = value.trim() || null;
    else if (value === null) updates[column] = null;
  };
  /** Required text (NOT NULL): a blank value is ignored rather than cleared. */
  const setRequiredText = (key: string, column: string) => {
    if (!has(key)) return;
    const value = body[key];
    if (typeof value === "string" && value.trim()) updates[column] = value.trim();
  };
  const setBool = (key: string, column: string) => {
    if (!has(key)) return;
    const value = body[key];
    if (typeof value === "boolean") updates[column] = value;
    else if (value === "true") updates[column] = true;
    else if (value === "false") updates[column] = false;
    else if (value === null) updates[column] = null;
  };
  const setStyle = () => {
    if (!has("style")) return;
    const value = body.style;
    if (value === "none" || value === null || value === "") updates.style = null;
    else {
      const parsed = Number(value);
      if (Number.isInteger(parsed)) updates.style = parsed;
    }
  };

  setRequiredText("title", "title");
  setRequiredText("channel", "channel");
  if (has("description") && typeof body.description === "string") updates.description = body.description.trim();
  setText("category", "category");
  setText("tournament", "tournament");
  setText("roundLevel", "roundLevel");
  setRequiredText("publishedAt", "publishedAt");
  // The edit dialog sends aff/neg/winner; older callers send affTeam/negTeam/affWin.
  setText(has("aff") ? "aff" : "affTeam", "aff");
  setText(has("neg") ? "neg" : "negTeam", "neg");
  setText("judgeDecision", "judgeDecision");
  setBool(has("winner") ? "winner" : "affWin", "winner");
  setStyle();

  updates.updatedAt = new Date();

  await db.update(youtubeRoundVideos).set(updates).where(eq(youtubeRoundVideos.id, id));

  const [updated] = await db.select().from(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, id)).limit(1);
  return NextResponse.json({ ok: true, id, video: updated });
}
