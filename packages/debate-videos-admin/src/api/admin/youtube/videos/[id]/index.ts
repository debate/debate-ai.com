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

  // Only fields the request sends are touched; an omitted key keeps its value.
  type QueueRowUpdate = Partial<typeof youtubeRoundVideos.$inferInsert>;
  type RequiredText = "title" | "channel" | "publishedAt";
  type NullableText = "category" | "tournament" | "roundLevel" | "aff" | "neg" | "judgeDecision";
  const updates: QueueRowUpdate = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const readText = (key: string): string | null | undefined => {
    if (!has(key)) return undefined;
    const value = body[key];
    if (value === null) return null;
    if (typeof value !== "string") return undefined;
    return value.trim() || null;
  };
  // NOT NULL columns: a blank value is ignored rather than written.
  const setRequired = (key: string, column: RequiredText) => {
    const value = readText(key);
    if (value) updates[column] = value;
  };
  const setNullable = (key: string, column: NullableText) => {
    const value = readText(key);
    if (value !== undefined) updates[column] = value === "none" && column === "category" ? null : value;
  };

  setRequired("title", "title");
  setRequired("channel", "channel");
  setRequired("publishedAt", "publishedAt");
  const description = readText("description");
  if (description !== undefined) updates.description = description ?? "";
  setNullable("category", "category");
  setNullable("tournament", "tournament");
  setNullable("roundLevel", "roundLevel");
  // The edit dialog sends row column names (aff, neg, winner); older callers
  // send affTeam / negTeam / affWin.
  setNullable(has("aff") ? "aff" : "affTeam", "aff");
  setNullable(has("neg") ? "neg" : "negTeam", "neg");
  setNullable("judgeDecision", "judgeDecision");

  const winnerKey = has("winner") ? "winner" : "affWin";
  if (has(winnerKey)) {
    const value = body[winnerKey];
    if (value === true || value === "true") updates.winner = true;
    else if (value === false || value === "false") updates.winner = false;
    else if (value === null) updates.winner = null;
  }
  if (has("style")) {
    const value = body.style;
    if (value === "none" || value === null) updates.style = null;
    else {
      const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
      if (Number.isInteger(parsed)) updates.style = parsed;
    }
  }

  updates.updatedAt = new Date();

  await db.update(youtubeRoundVideos).set(updates).where(eq(youtubeRoundVideos.id, id));

  const [updated] = await db.select().from(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, id)).limit(1);
  return NextResponse.json({ ok: true, id, video: updated });
}
