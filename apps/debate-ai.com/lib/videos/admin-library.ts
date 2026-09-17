/**
 * @fileoverview Admin read/write side of the published video library.
 *
 * The admin page's "Round videos" queue only ever showed `youtube_round_videos`
 * — rounds waiting to be published. Once a video is published it leaves that
 * queue for the public `videos` table and, until now, there was no way to touch
 * it again short of a database console. This module backs the admin library
 * browser: search any published video, edit its metadata, or remove it.
 *
 * Writes go through {@link updateLibraryVideo} rather than a raw update so the
 * derived columns the public feed sorts and searches on (`published_ms`,
 * `season_year`, `search_text`) stay consistent with the fields an admin edits.
 * @module lib/videos/admin-library
 */

import { and, asc, count, desc, eq, isNull, like, or, type SQL } from "drizzle-orm";
import {
  publishedMsForDate,
  seasonYearForDate,
} from "debate-data-sync/src/videos/video-rows";
import {
  videos,
  youtubeRoundVideos,
  youtubeVideoExclusions,
  type VideoTableRow,
} from "@/lib/database/schema";

/** Default and maximum page sizes for {@link listLibraryVideos}. */
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/** Filters accepted by the admin library listing. */
export interface LibraryQuery {
  /** Free-text match over title, channel and tournament. */
  q?: string | null;
  /** Numeric debate style (1 Policy, 2 PF, 3 LD, 4 College). */
  style?: number | null;
  /** `round`, `lecture`, or anything else for no source filter. */
  source?: string | null;
  /** `1`-based page number. */
  page?: number;
  limit?: number;
  /** Column to order by; unknown values fall back to `published`. */
  sort?: string | null;
  dir?: "asc" | "desc";
}

/** One page of admin library rows. */
export interface LibraryPage {
  videos: VideoTableRow[];
  page: number;
  limit: number;
  pageCount: number;
  total: number;
}

/**
 * Fields an admin may edit. Deliberately excludes the primary key and the
 * derived columns — `videoId` identifies the row, and `publishedMs`,
 * `seasonYear` and `searchText` are recomputed from the fields below.
 */
export const EDITABLE_FIELDS = [
  "title",
  "channel",
  "publishedAt",
  "description",
  "viewCount",
  "style",
  "category",
  "categoryKey",
  "tournament",
  "roundLevel",
  "affTeam",
  "negTeam",
  "affWin",
  "judgeDecision",
  "isTopPick",
  "speechDocsUrl",
  "source",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

/** A partial edit of one library row, as it arrives from the admin form. */
export type LibraryVideoPatch = Partial<Record<EditableField, unknown>>;

/** Columns the admin table can sort on, mapped onto their drizzle column. */
const SORT_COLUMNS = {
  published: videos.publishedMs,
  views: videos.viewCount,
  title: videos.title,
  channel: videos.channel,
  style: videos.style,
  category: videos.category,
  updated: videos.updatedAt,
} as const;

/** Escapes the LIKE wildcards so a literal `%` or `_` searches as itself. */
function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

/** Trims a value to a string, or `null` when it is absent or blank. */
function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Coerces the tri-state `affWin` (aff won / neg won / not recorded). */
function optionalBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1" || value === 1;
}

/** Coerces a number, or `null` when the value is absent or unparseable. */
function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Turns an admin form patch into a validated `videos` update.
 *
 * Only keys present on `patch` are written, so a form that edits one field
 * does not blank out the rest of the row. Derived columns are recomputed from
 * the merged row rather than the patch, so editing the title alone still
 * leaves `search_text` matching the stored channel and description.
 *
 * @param current - The row as stored, used to merge derived columns.
 * @param patch - Fields the admin changed.
 * @returns The update object to hand drizzle.
 */
export function buildLibraryUpdate(
  current: VideoTableRow,
  patch: LibraryVideoPatch,
): Partial<VideoTableRow> {
  const update: Record<string, unknown> = {};
  const has = (field: EditableField) => Object.hasOwn(patch, field);

  if (has("title")) update.title = String(patch.title ?? "").trim();
  if (has("channel")) update.channel = String(patch.channel ?? "").trim();
  if (has("description")) update.description = String(patch.description ?? "");
  if (has("publishedAt")) update.publishedAt = String(patch.publishedAt ?? "").trim();
  if (has("source")) update.source = String(patch.source ?? "").trim() || current.source;
  if (has("viewCount")) update.viewCount = Math.max(0, Math.trunc(optionalNumber(patch.viewCount) ?? 0));
  if (has("style")) update.style = optionalNumber(patch.style);
  if (has("category")) update.category = optionalText(patch.category);
  if (has("categoryKey")) update.categoryKey = optionalText(patch.categoryKey);
  if (has("tournament")) update.tournament = optionalText(patch.tournament);
  if (has("roundLevel")) update.roundLevel = optionalText(patch.roundLevel);
  if (has("affTeam")) update.affTeam = optionalText(patch.affTeam);
  if (has("negTeam")) update.negTeam = optionalText(patch.negTeam);
  if (has("affWin")) update.affWin = optionalBoolean(patch.affWin);
  if (has("judgeDecision")) update.judgeDecision = optionalText(patch.judgeDecision);
  if (has("speechDocsUrl")) update.speechDocsUrl = optionalText(patch.speechDocsUrl);
  if (has("isTopPick")) update.isTopPick = optionalBoolean(patch.isTopPick) ?? false;

  // A blank publish date would sort the video to the very end of the feed and
  // drop it out of every season filter, so keep the stored one instead.
  if (typeof update.publishedAt === "string" && update.publishedAt.length === 0) {
    delete update.publishedAt;
  }

  const publishedAt = (update.publishedAt as string | undefined) ?? current.publishedAt;
  if (publishedAt !== current.publishedAt) {
    update.publishedMs = publishedMsForDate(publishedAt);
    update.seasonYear = seasonYearForDate(publishedAt);
  }

  if (has("title") || has("channel") || has("description")) {
    const title = (update.title as string | undefined) ?? current.title;
    const channel = (update.channel as string | undefined) ?? current.channel;
    const description = (update.description as string | undefined) ?? current.description;
    update.searchText = `${title} ${channel} ${description}`.toLowerCase();
  }

  update.updatedAt = new Date();
  return update as Partial<VideoTableRow>;
}

/** Builds the WHERE clauses shared by the listing and its total count. */
function libraryConditions(query: LibraryQuery): SQL[] {
  const conditions: SQL[] = [];

  const search = query.q?.trim();
  if (search) {
    const pattern = likePattern(search);
    const match = or(
      like(videos.title, pattern),
      like(videos.channel, pattern),
      like(videos.tournament, pattern),
      like(videos.videoId, pattern),
    );
    if (match) conditions.push(match);
  }

  if (query.style !== null && query.style !== undefined && Number.isFinite(query.style)) {
    conditions.push(eq(videos.style, query.style));
  }

  if (query.source === "lecture") {
    // Lectures are the rows with no numeric debate style, matching how
    // `/api/videos` splits the library for the public "All Lectures" tab.
    conditions.push(isNull(videos.style));
  } else if (query.source && query.source !== "all") {
    // "all" is the picker's own no-filter value, not a stored `source`;
    // matching it literally would return an empty table.
    conditions.push(eq(videos.source, query.source));
  }

  return conditions;
}

/**
 * Lists published videos for the admin table, newest first by default.
 *
 * Offset pagination rather than the queue's keyset cursor: the admin table
 * has numbered pages and sorts on columns that are not unique, which a cursor
 * over `(publishedAt, id)` cannot express.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite in development).
 * @param query - Search, filter, sort and paging options.
 * @returns One page of rows plus the total matching count.
 */
export async function listLibraryVideos(db: any, query: LibraryQuery): Promise<LibraryPage> {
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const conditions = libraryConditions(query);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totals] = await db.select({ rows: count() }).from(videos).where(where);
  const total = totals?.rows ?? 0;
  const pageCount = Math.max(Math.ceil(total / limit), 1);
  const page = Math.min(Math.max(query.page ?? 1, 1), pageCount);

  const column = SORT_COLUMNS[(query.sort ?? "published") as keyof typeof SORT_COLUMNS]
    ?? SORT_COLUMNS.published;
  const direction = query.dir === "asc" ? asc : desc;

  const rows = await db
    .select()
    .from(videos)
    .where(where)
    // `video_id` breaks ties so paging stays stable when a sort column repeats.
    .orderBy(direction(column), desc(videos.videoId))
    .limit(limit)
    .offset((page - 1) * limit);

  return { videos: rows, page, limit, pageCount, total };
}

/**
 * Applies an admin edit to one published video.
 *
 * @param db - Drizzle handle.
 * @param videoId - The video's YouTube id.
 * @param patch - Fields the admin changed.
 * @returns The updated row, or `null` when no such video is published.
 */
export async function updateLibraryVideo(
  db: any,
  videoId: string,
  patch: LibraryVideoPatch,
): Promise<VideoTableRow | null> {
  const [current] = await db.select().from(videos).where(eq(videos.videoId, videoId)).limit(1);
  if (!current) return null;

  const update = buildLibraryUpdate(current, patch);
  await db.update(videos).set(update).where(eq(videos.videoId, videoId));

  const [updated] = await db.select().from(videos).where(eq(videos.videoId, videoId)).limit(1);
  return updated ?? null;
}

/**
 * Removes a published video from the library for good.
 *
 * Deletes it from the public `videos` table and from the resync queue, and
 * records it in `youtube_video_exclusions` so the next weekly YouTube sync
 * does not quietly re-ingest and re-publish the video an admin just removed
 * — the same guarantee the queue's per-row delete gives.
 *
 * @param db - Drizzle handle.
 * @param videoId - The video's YouTube id.
 * @param deletedBy - Admin email, when known, for the audit row.
 * @returns Whether a published row was actually removed.
 */
export async function deleteLibraryVideo(
  db: any,
  videoId: string,
  deletedBy: string | null,
): Promise<boolean> {
  const [current] = await db
    .select({ videoId: videos.videoId })
    .from(videos)
    .where(eq(videos.videoId, videoId))
    .limit(1);

  // Nothing published under this id: report the miss without writing an
  // exclusion, so the route's 404 has no side effect of its own.
  if (!current) return false;

  await db.delete(videos).where(eq(videos.videoId, videoId));
  await db.delete(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, videoId));
  await db
    .insert(youtubeVideoExclusions)
    .values({ videoId, deletedBy, deletedAt: new Date() })
    .onConflictDoUpdate({
      target: youtubeVideoExclusions.videoId,
      set: { deletedBy, deletedAt: new Date() },
    });

  return true;
}
