/**
 * @fileoverview Query side of the admin "YouTube channels" tab.
 *
 * The list of channels the weekly resync scans used to live in
 * `packages/debate-data-sync/src/youtube/channel-config.ts` — a source file, so
 * adding one meant a code change and a deploy. It now lives in the
 * `youtube_channels` SQL table (see `lib/database/schema.ts`), managed from
 * `/admin`'s channels tab, so an admin can add, rename or pause a channel
 * without touching code.
 *
 * The resync resolves each channel's YouTube id from its name on the first
 * successful scan and writes it back, so the admin never has to type an id —
 * and a renamed channel keeps working until the next scan re-resolves it.
 * @module lib/youtube/admin-channels
 */

import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { youtubeChannels, type YoutubeChannel } from "@/lib/database/schema";

/** One row, as the admin panel renders it. */
export interface YoutubeChannelRow {
  id: number;
  channelId: string | null;
  name: string;
  enabled: boolean;
  addedBy: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Query parameters accepted by {@link listAdminChannels}. */
export interface ListAdminChannelsQuery {
  limit?: number | null;
  cursor?: string | null;
}

/** One page of channels, plus a cursor for the next. */
export interface AdminChannelPage {
  channels: YoutubeChannelRow[];
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Cursor is the row id — an autoincrement integer, so it is strictly
 * increasing and safe for keyset pagination. */
export function encodeChannelCursor(id: number): string {
  return String(id);
}

function decodeChannelCursor(cursor: string): number | null {
  const n = Number(cursor);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * Lists every subscribed channel, newest first, keyset-paginated.
 *
 * Offset pagination is avoided here for the same reason as the round-video
 * queue: a channel added mid-list would otherwise shift rows and cause the
 * page to skip or repeat one.
 */
export async function listAdminChannels(db: any, query: ListAdminChannelsQuery = {}): Promise<AdminChannelPage> {
  const limit = Math.min(Math.max(query.limit || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const conditions = [];
  if (query.cursor) {
    const cursorId = decodeChannelCursor(query.cursor);
    if (cursorId !== null) {
      conditions.push(sql`${youtubeChannels.id} < ${cursorId}`);
    }
  }

  const rows = await db
    .select(getTableColumns(youtubeChannels))
    .from(youtubeChannels)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(youtubeChannels.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const channels = hasMore ? rows.slice(0, limit) : rows;
  const last = channels[channels.length - 1];
  const nextCursor = hasMore && last ? encodeChannelCursor(last.id) : null;

  return { channels: channels.map(toRow), nextCursor };
}

/** One channel, looked up by name. Returns null when nothing matches. */
export async function findAdminChannelByName(db: any, name: string): Promise<YoutubeChannelRow | null> {
  const [row] = await db.select().from(youtubeChannels).where(eq(youtubeChannels.name, name)).limit(1);
  return row ? toRow(row) : null;
}

/** One channel, looked up by row id. Returns null when nothing matches. */
export async function findAdminChannelById(db: any, id: number): Promise<YoutubeChannelRow | null> {
  const [row] = await db.select().from(youtubeChannels).where(eq(youtubeChannels.id, id)).limit(1);
  return row ? toRow(row) : null;
}

function toRow(row: YoutubeChannel): YoutubeChannelRow {
  return {
    id: row.id,
    channelId: row.channelId,
    name: row.name,
    enabled: Boolean(row.enabled),
    addedBy: row.addedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}