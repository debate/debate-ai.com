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

import { asc, eq, getTableColumns, sql } from "drizzle-orm";
import { youtubeChannels, type YoutubeChannel } from "@/lib/database/schema";
import { ensureTableColumns } from "@/lib/database/ensure-columns";

/** A channel's newest known video. */
export interface ChannelLatestVideo {
  videoId: string;
  title: string;
  publishedAt: string;
}

/** One row, as the admin panel renders it. */
export interface YoutubeChannelRow {
  id: number;
  channelId: string | null;
  name: string;
  /** Display title YouTube reports on the channel's videos, once a resync has seen one. */
  title: string | null;
  enabled: boolean;
  addedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Videos from this channel in the library (`videos`) plus the round queue. */
  videoCount: number;
  latestVideo: ChannelLatestVideo | null;
}

/** Every channel in one response. `nextCursor` is always null: the list is
 * sorted by video count, which keyset pagination on the row id can't follow,
 * and a subscription list is small enough to send whole. */
export interface AdminChannelPage {
  channels: YoutubeChannelRow[];
  nextCursor: string | null;
}

/** Per-channel video tally, keyed by {@link channelKey}. */
interface ChannelVideoStats {
  count: number;
  latest: ChannelLatestVideo | null;
}

/**
 * The key a channel and a video are matched on: lowercased, `@` dropped, and
 * everything but letters and digits removed, so "@TexasDebate" meets a video
 * whose channel reads "Texas Debate".
 */
export function channelKey(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/^@/, "").replace(/[^a-z0-9]/g, "");
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return ((result as { results?: unknown[]; rows?: unknown[] })?.results ??
    (result as { rows?: unknown[] })?.rows ??
    []) as Record<string, unknown>[];
}

/**
 * Counts videos per channel across the published library and the round queue
 * in one grouped query. A video sits in one or the other, never both — the
 * queue skips ids already in `videos` — so the union does not double count.
 * The bare `video_id` / `title` next to `MAX(published_at)` is SQLite's
 * min/max rule: they come from the row holding the max.
 */
async function videoStatsByChannel(db: any): Promise<Map<string, ChannelVideoStats>> {
  const result = await db.all(sql`
    SELECT channel, COUNT(*) AS video_count, MAX(published_at) AS published_at, video_id, title
    FROM (
      SELECT channel, published_at, video_id, title FROM videos WHERE channel <> ''
      UNION ALL
      SELECT channel, published_at, id AS video_id, title FROM youtube_round_videos
    )
    GROUP BY channel
  `);

  const stats = new Map<string, ChannelVideoStats>();
  for (const row of rowsOf(result)) {
    const key = channelKey(String(row.channel ?? ""));
    if (!key) continue;
    const latest: ChannelLatestVideo = {
      videoId: String(row.video_id ?? ""),
      title: String(row.title ?? ""),
      publishedAt: String(row.published_at ?? ""),
    };
    // Spellings that differ only in case or punctuation share a key; merge them.
    const prev = stats.get(key);
    const count = Number(row.video_count) || 0;
    if (!prev) {
      stats.set(key, { count, latest });
    } else {
      prev.count += count;
      if (!prev.latest || latest.publishedAt > prev.latest.publishedAt) prev.latest = latest;
    }
  }
  return stats;
}

/**
 * Lists every subscribed channel with its video count and newest video, most
 * videos first (ties by name).
 *
 * Videos record the channel's display title rather than the handle an admin
 * types, so a channel is matched through `title` (written by the resync) and
 * falls back to its name — enough for handles like "TexasDebate" before the
 * first resync fills the title in.
 */
export async function listAdminChannels(db: any): Promise<AdminChannelPage> {
  await ensureTableColumns(db, youtubeChannels);
  const [rows, stats] = await Promise.all([
    db.select(getTableColumns(youtubeChannels)).from(youtubeChannels).orderBy(asc(youtubeChannels.name)),
    videoStatsByChannel(db),
  ]);

  const channels = (rows as YoutubeChannel[]).map((row) => {
    const match = stats.get(channelKey(row.title)) ?? stats.get(channelKey(row.name));
    return toRow(row, match);
  });
  channels.sort((a, b) => b.videoCount - a.videoCount || a.name.localeCompare(b.name));

  return { channels, nextCursor: null };
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

function toRow(row: YoutubeChannel, stats?: ChannelVideoStats): YoutubeChannelRow {
  return {
    id: row.id,
    channelId: row.channelId,
    name: row.name,
    title: row.title ?? null,
    enabled: Boolean(row.enabled),
    addedBy: row.addedBy,
    // Serialized as ISO strings in the JSON response, which the admin panel
    // (YoutubeChannelsPanel) formats directly.
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    videoCount: stats?.count ?? 0,
    latestVideo: stats?.latest ?? null,
  };
}