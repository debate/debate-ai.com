import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { youtubeRoundVideos, type YoutubeRoundVideo } from "@/lib/database/schema";
import { publishRoundVideos } from "@/lib/videos/publish-round-video";

/**
 * Publishes every currently queued round video (optionally narrowed to the
 * style the admin page has filtered to) into the public `videos` table, then
 * clears the published rows out of the queue — the "publish all" bulk
 * counterpart to the per-video publish action.
 */
export async function POST(req: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const styleParam = searchParams.get("style");

  const conditions = [];
  if (styleParam) {
    const style = Number(styleParam);
    if (Number.isFinite(style)) conditions.push(eq(youtubeRoundVideos.style, style));
  }

  const db = await getDBFromContext();
  const rows = await db
    .select()
    .from(youtubeRoundVideos)
    .where(conditions.length ? and(...conditions) : undefined);

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, published: 0 });
  }

  const published = await publishRoundVideos(db, rows);
  await db.delete(youtubeRoundVideos).where(
    inArray(
      youtubeRoundVideos.id,
      rows.map((row: YoutubeRoundVideo) => row.id),
    ),
  );

  return NextResponse.json({ ok: true, published });
}
