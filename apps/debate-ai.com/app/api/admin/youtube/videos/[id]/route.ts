import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { videos, youtubeRoundVideos, youtubeVideoExclusions } from "@/lib/database/schema";

/** Makes a YouTube round unavailable immediately and persists that decision so
 * a subsequent resync will not re-add it. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin, email } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{6,}$/.test(id)) return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });

  const db = await getDBFromContext();
  await db.insert(youtubeVideoExclusions).values({ videoId: id, deletedBy: email })
    .onConflictDoUpdate({ target: youtubeVideoExclusions.videoId, set: { deletedBy: email, deletedAt: new Date() } });
  await db.delete(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, id));
  await db.delete(videos).where(eq(videos.videoId, id));
  return NextResponse.json({ deleted: true });
}
