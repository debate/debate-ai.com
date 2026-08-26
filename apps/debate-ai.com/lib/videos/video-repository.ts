/**
 * @fileoverview Read side of the video library.
 *
 * Serves paginated video pages and the small metadata payload from the
 * `videos` SQL table (Cloudflare D1 in production, local SQLite via libSQL in
 * development), falling back to the JSON assets whenever the table is missing,
 * unreachable, or not yet seeded. Both paths return identical shapes, so the
 * client never has to care which one answered.
 * @module lib/videos/video-repository
 */

import { and, asc, count, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { videos } from "@/lib/database/schema";
import { getDBFromContext } from "@/lib/database/context";
import {
  videoRowToTuple,
  type VideoRow,
  type VideoTuple,
} from "debate-data-sync/src/videos/video-rows";
import {
  clampPageSize,
  computeLectureCategories,
  computeVideoFacets,
  filterVideoRows,
  parseSeasonFilter,
  queryVideoRows,
  searchTokens,
  type LectureCategoryFacet,
  type VideoFacets,
  type VideoQueryParams,
} from "debate-data-sync/src/videos/video-query";
import { getVideoRowsFromJson } from "./video-json-source";

/** Which backend answered a request — surfaced for debugging. */
export type VideoBackend = "sql" | "json";

/** One page of the video feed. */
export interface VideoPage {
  /** Videos in UI tuple form. */
  videos: VideoTuple[];
  /** Total number of videos matching the filters, ignoring pagination. */
  total: number;
  offset: number;
  limit: number;
  /** Whether another page exists after this one. */
  hasMore: boolean;
  /** Season/style dropdown counts, omitted unless requested. */
  facets?: VideoFacets;
  backend: VideoBackend;
}

/** Library-wide totals used by the quick-link cards. */
export interface VideoCounts {
  total: number;
  rounds: number;
  /** Videos from the lectures asset. */
  lectures: number;
  /** Videos with no numeric debate style — the "All Lectures" tab. */
  lecturesOnly: number;
  topPicks: number;
  /** Count per numeric debate style (1–4). */
  byStyle: Record<number, number>;
}

/** Metadata payload backing the page chrome (counts, category cards). */
export interface VideoMeta {
  counts: VideoCounts;
  lectureCategories: LectureCategoryFacet[];
  backend: VideoBackend;
}

/** How long a probe of the `videos` table stays cached, in milliseconds. */
const BACKEND_PROBE_TTL_MS = 60_000;

let backendProbe: { ready: boolean; checkedAt: number } | null = null;

/**
 * Resolves the drizzle handle, or `null` when no database is reachable.
 *
 * @returns The drizzle instance, or `null` in environments without a binding.
 */
async function tryGetDb() {
  try {
    return await getDBFromContext();
  } catch {
    return null;
  }
}

/**
 * Checks whether the `videos` table exists and holds rows, with a short TTL so
 * a seed run is picked up without a redeploy.
 *
 * @param db - Drizzle handle.
 * @returns `true` when the table can serve reads.
 */
async function isTableSeeded(db: any): Promise<boolean> {
  const now = Date.now();
  if (backendProbe && now - backendProbe.checkedAt < BACKEND_PROBE_TTL_MS) {
    return backendProbe.ready;
  }
  let ready = false;
  try {
    const [row] = await db.select({ value: count() }).from(videos).limit(1);
    ready = (row?.value ?? 0) > 0;
  } catch {
    ready = false;
  }
  backendProbe = { ready, checkedAt: now };
  return ready;
}

/** Escapes `LIKE` wildcards so a literal `%` in a search term stays literal. */
function likePattern(token: string): string {
  return `%${token.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Translates {@link VideoQueryParams} into SQL predicates.
 *
 * @param params - Query parameters.
 * @param options - Set `skipSearch`, `skipYear` or `skipStyle` to leave that
 *   dimension out, which is how facet counts ignore their own filter.
 * @returns The predicate list (possibly empty).
 */
function buildConditions(
  params: VideoQueryParams,
  options: { skipSearch?: boolean; skipYear?: boolean; skipStyle?: boolean } = {},
): SQL[] {
  const conditions: SQL[] = [];

  if (params.source && params.source !== "all") {
    conditions.push(eq(videos.source, params.source));
  }
  if (params.lecturesOnly) conditions.push(isNull(videos.style));
  if (params.topPicksOnly) conditions.push(eq(videos.isTopPick, true));
  if (params.categoryKey) conditions.push(eq(videos.categoryKey, params.categoryKey));
  if (!options.skipStyle && params.style != null) {
    conditions.push(eq(videos.style, params.style));
  }
  if (!options.skipYear) {
    const season = parseSeasonFilter(params.year);
    if (season !== null) conditions.push(eq(videos.seasonYear, season));
  }
  if (params.ids && params.ids.length) {
    conditions.push(inArray(videos.videoId, params.ids));
  }
  if (!options.skipSearch) {
    for (const token of searchTokens(params.q)) {
      conditions.push(sql`${videos.searchText} LIKE ${likePattern(token)} ESCAPE '\\'`);
    }
  }

  return conditions;
}

/** Combines predicates into a single `WHERE` clause, or `undefined` for none. */
function whereClause(conditions: SQL[]): SQL | undefined {
  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
}

/** Row-to-tuple mapper shared by both backends. */
function toTuples(rows: VideoRow[]): VideoTuple[] {
  return rows.map(videoRowToTuple);
}

/**
 * Runs the facet queries against SQL.
 *
 * @param db - Drizzle handle.
 * @param params - Active query parameters.
 * @returns Season and style counts.
 */
async function facetsFromSql(db: any, params: VideoQueryParams): Promise<VideoFacets> {
  const yearConditions = buildConditions(params, { skipSearch: true, skipYear: true });
  const styleConditions = buildConditions(params, { skipSearch: true, skipStyle: true });

  const [yearRows, styleRows] = await Promise.all([
    db
      .select({ season: videos.seasonYear, value: count() })
      .from(videos)
      .where(whereClause(yearConditions))
      .groupBy(videos.seasonYear),
    db
      .select({ style: videos.style, value: count() })
      .from(videos)
      .where(whereClause(styleConditions))
      .groupBy(videos.style),
  ]);

  const yearCounts: Record<string, number> = {};
  for (const row of yearRows) {
    yearCounts[row.season === 0 ? "legacy" : String(row.season)] = row.value;
  }

  const styleCounts: Record<number, number> = {};
  for (const row of styleRows) {
    if (row.style == null) continue;
    styleCounts[row.style] = row.value;
  }

  return { yearCounts, styleCounts };
}

/**
 * Fetches one page of videos.
 *
 * @param params - Filters, sort and pagination; see {@link VideoQueryParams}.
 * @param includeFacets - Whether to also compute the dropdown counts.
 * @returns One page plus the total match count. See {@link VideoPage}.
 */
export async function getVideoPage(
  params: VideoQueryParams,
  includeFacets = false,
): Promise<VideoPage> {
  const limit = clampPageSize(params.limit);
  const offset = Math.max(0, params.offset ?? 0);

  const db = await tryGetDb();
  if (db && (await isTableSeeded(db))) {
    try {
      const where = whereClause(buildConditions(params));
      const orderBy =
        params.sort === "Views"
          ? [desc(videos.viewCount), asc(videos.videoId)]
          : [desc(videos.publishedMs), asc(videos.videoId)];

      const [rows, totals, facets] = await Promise.all([
        db.select().from(videos).where(where).orderBy(...orderBy).limit(limit).offset(offset),
        db.select({ value: count() }).from(videos).where(where),
        includeFacets ? facetsFromSql(db, params) : Promise.resolve(undefined),
      ]);

      const total = totals[0]?.value ?? 0;
      return {
        videos: toTuples(rows as VideoRow[]),
        total,
        offset,
        limit,
        hasMore: offset + rows.length < total,
        facets,
        backend: "sql",
      };
    } catch (error) {
      console.error("videos: SQL page query failed, falling back to JSON", error);
      backendProbe = { ready: false, checkedAt: Date.now() };
    }
  }

  const allRows = await getVideoRowsFromJson();
  const { rows, total } = queryVideoRows(allRows, { ...params, limit, offset });
  return {
    videos: toTuples(rows),
    total,
    offset,
    limit,
    hasMore: offset + rows.length < total,
    facets: includeFacets ? computeVideoFacets(allRows, params) : undefined,
    backend: "json",
  };
}

/**
 * Fetches the library-wide counts and lecture-category cards.
 *
 * @returns See {@link VideoMeta}.
 */
export async function getVideoMeta(): Promise<VideoMeta> {
  const db = await tryGetDb();
  if (db && (await isTableSeeded(db))) {
    try {
      const [[totalRow], sourceRows, styleRows, [lecturesOnlyRow], [topPicksRow], categoryRows] =
        await Promise.all([
          db.select({ value: count() }).from(videos),
          db.select({ source: videos.source, value: count() }).from(videos).groupBy(videos.source),
          db.select({ style: videos.style, value: count() }).from(videos).groupBy(videos.style),
          db.select({ value: count() }).from(videos).where(isNull(videos.style)),
          db.select({ value: count() }).from(videos).where(eq(videos.isTopPick, true)),
          db
            .select({
              key: videos.categoryKey,
              label: videos.category,
              value: count(),
              maxViews: sql<number>`max(${videos.viewCount})`,
            })
            .from(videos)
            .where(isNull(videos.style))
            .groupBy(videos.categoryKey, videos.category),
        ]);

      const byStyle: Record<number, number> = {};
      for (const row of styleRows) {
        if (row.style == null) continue;
        byStyle[row.style] = row.value;
      }

      const bySource: Record<string, number> = {};
      for (const row of sourceRows) bySource[row.source] = row.value;

      const lectureCategories: LectureCategoryFacet[] = categoryRows
        .filter((row: any) => row.key && row.label && row.label !== "Awards")
        .map((row: any) => ({
          key: row.key as string,
          label: row.label as string,
          count: row.value as number,
          maxViews: (row.maxViews as number) ?? 0,
        }))
        .sort((a: LectureCategoryFacet, b: LectureCategoryFacet) => b.maxViews - a.maxViews);

      return {
        counts: {
          total: totalRow?.value ?? 0,
          rounds: bySource.round ?? 0,
          lectures: bySource.lecture ?? 0,
          lecturesOnly: lecturesOnlyRow?.value ?? 0,
          topPicks: topPicksRow?.value ?? 0,
          byStyle,
        },
        lectureCategories,
        backend: "sql",
      };
    } catch (error) {
      console.error("videos: SQL meta query failed, falling back to JSON", error);
      backendProbe = { ready: false, checkedAt: Date.now() };
    }
  }

  const allRows = await getVideoRowsFromJson();
  const byStyle: Record<number, number> = {};
  for (const row of allRows) {
    if (row.style == null) continue;
    byStyle[row.style] = (byStyle[row.style] ?? 0) + 1;
  }

  return {
    counts: {
      total: allRows.length,
      rounds: allRows.filter((r) => r.source === "round").length,
      lectures: allRows.filter((r) => r.source === "lecture").length,
      lecturesOnly: filterVideoRows(allRows, { lecturesOnly: true }).length,
      topPicks: allRows.filter((r) => r.isTopPick).length,
      byStyle,
    },
    lectureCategories: computeLectureCategories(allRows),
    backend: "json",
  };
}
