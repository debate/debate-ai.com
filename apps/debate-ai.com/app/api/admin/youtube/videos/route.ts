import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { youtubeRoundVideos } from "@/lib/database/schema";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

function encodeCursor(publishedAt: string, id: string): string {
  return Buffer.from(JSON.stringify([publishedAt, id])).toString("base64url");
}

function decodeCursor(cursor: string): [string, string] | null {
  try {
    const [publishedAt, id] = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
    if (typeof publishedAt !== "string" || typeof id !== "string") return null;
    return [publishedAt, id];
  } catch {
    return null;
  }
}

/**
 * Keyset-paginated list of SQL-stored round videos, newest first, for the
 * admin page's infinite scroll. Cursor is the (publishedAt, id) of the last
 * row seen — offset pagination would skip/repeat rows as new videos land.
 */
export async function GET(req: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDBFromContext();
  const { searchParams } = new URL(req.url);

  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const cursorParam = searchParams.get("cursor");
  const styleParam = searchParams.get("style");
  const channelParam = searchParams.get("channel");

  const conditions = [];

  if (styleParam) {
    const style = Number(styleParam);
    if (Number.isFinite(style)) conditions.push(eq(youtubeRoundVideos.style, style));
  }

  if (channelParam) {
    conditions.push(eq(youtubeRoundVideos.channel, channelParam));
  }

  if (cursorParam) {
    const decoded = decodeCursor(cursorParam);
    if (decoded) {
      const [cursorPublishedAt, cursorId] = decoded;
      conditions.push(
        or(
          lt(youtubeRoundVideos.publishedAt, cursorPublishedAt),
          and(eq(youtubeRoundVideos.publishedAt, cursorPublishedAt), lt(youtubeRoundVideos.id, cursorId)),
        ),
      );
    }
  }

  const rows = await db
    .select()
    .from(youtubeRoundVideos)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(youtubeRoundVideos.publishedAt), desc(youtubeRoundVideos.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const videos = hasMore ? rows.slice(0, limit) : rows;
  const last = videos[videos.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.publishedAt, last.id) : null;

  return NextResponse.json({ videos, nextCursor });
}
