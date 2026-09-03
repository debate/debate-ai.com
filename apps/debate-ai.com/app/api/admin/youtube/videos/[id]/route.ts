import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { youtubeRoundVideos } from "@/lib/database/schema";
import { publishRoundVideos } from "@/lib/videos/publish-round-video";

/**
 * Publishes one queued round video to the public `videos` table, then drops
 * it from the resync queue — matches the bulk `publish-all` route, scoped to
 * a single video for the admin page's per-row "Publish" action.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = await getDBFromContext();

  const [row] = await db.select().from(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, id)).limit(1);
  if (!row) {
    return NextResponse.json({ error: "Video not found in queue" }, { status: 404 });
  }

  await publishRoundVideos(db, [row]);
  await db.delete(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, id));

  return NextResponse.json({ ok: true, id });
}

/** Removes one video from the resync queue without publishing it. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = await getDBFromContext();

  await db.delete(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, id));

  return NextResponse.json({ ok: true, id });
}
