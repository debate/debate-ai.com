/**
 * @fileoverview Query side of the admin "Round videos" resync queue.
 *
 * Split out of `app/api/admin/youtube/videos/route.ts` so the query it builds
 * can be exercised against a real database in tests, the same reason
 * `lib/videos/admin-library.ts` is split from its own route.
 * @module lib/youtube/admin-round-videos
 */

import { and, desc, eq, getTableColumns, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { videos as videosTable, youtubeRoundVideos, type YoutubeRoundVideo } from "@/lib/database/schema";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export function encodeCursor(publishedAt: string, id: string): string {
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

/** Query parameters accepted by {@link listPendingRoundVideos}. */
export interface PendingRoundVideoQuery {
  limit?: number | null;
  cursor?: string | null;
  style?: number | null;
  channel?: string | null;
  q?: string | null;
}

/** One keyset page of unpublished round videos, plus a cursor for the next. */
export interface PendingRoundVideoPage {
  videos: YoutubeRoundVideo[];
  nextCursor: string | null;
}

/**
 * Keyset-paginated list of SQL-stored round videos, newest first, for the
 * admin page's infinite scroll. Cursor is the (publishedAt, id) of the last
 * row seen — offset pagination would skip/repeat rows as new videos land.
 */
export async function listPendingRoundVideos(db: any, query: PendingRoundVideoQuery): Promise<PendingRoundVideoPage> {
  const limit = Math.min(Math.max(query.limit || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const conditions: SQL[] = [];

  if (query.style !== null && query.style !== undefined && Number.isFinite(query.style)) {
    conditions.push(eq(youtubeRoundVideos.style, query.style));
  }

  if (query.channel) {
    conditions.push(eq(youtubeRoundVideos.channel, query.channel));
  }

  const search = query.q?.trim();
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      or(
        sql`${youtubeRoundVideos.title} LIKE ${pattern} ESCAPE '\\'`,
        sql`${youtubeRoundVideos.channel} LIKE ${pattern} ESCAPE '\\'`,
      )!,
    );
  }

  if (query.cursor) {
    const decoded = decodeCursor(query.cursor);
    if (decoded) {
      const [cursorPublishedAt, cursorId] = decoded;
      conditions.push(
        or(
          lt(youtubeRoundVideos.publishedAt, cursorPublishedAt),
          and(eq(youtubeRoundVideos.publishedAt, cursorPublishedAt), lt(youtubeRoundVideos.id, cursorId)),
        )!,
      );
    }
  }

  // Left-join against the published `videos` table and drop matches, so a
  // round already published to the main site clears out of the queue
  // instead of piling up alongside every future resync.
  const rows = await db
    .select(getTableColumns(youtubeRoundVideos))
    .from(youtubeRoundVideos)
    .leftJoin(videosTable, eq(youtubeRoundVideos.id, videosTable.videoId))
    .where(and(isNull(videosTable.videoId), ...conditions))
    .orderBy(desc(youtubeRoundVideos.publishedAt), desc(youtubeRoundVideos.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const videos = hasMore ? rows.slice(0, limit) : rows;
  const last = videos[videos.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.publishedAt, last.id) : null;

  return { videos, nextCursor };
}
