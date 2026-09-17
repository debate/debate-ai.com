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

import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, notInArray, sql, type SQL } from "drizzle-orm";
import { videos } from "@/lib/database/schema";
import { getDBFromContext } from "@/lib/database/context";
import {
  normalizeCategoryKey,
  stripTournamentYear,
  videoRowToTuple,
  type VideoRow,
  type VideoTuple,
} from "debate-data-sync/src/videos/video-rows";
import {
  clampPageSize,
  computeLectureCategories,
  computeVideoFacets,
  computeVideoSuggestions,
  filterVideoRows,
  parseSeasonFilter,
  queryVideoRows,
  rankKeywordSuggestions,
  rankTournamentSuggestions,
  searchTokens,
  SUGGESTED_KEYWORDS,
  type LectureCategoryFacet,
  type VideoFacets,
  type VideoQueryParams,
  type VideoSuggestions,
} from "debate-data-sync/src/videos/video-query";
import {
  VIDEO_INDEX_FORMAT_VERSION,
  videoRowToIndexTuple,
  type VideoIndexResponse,
} from "debate-data-sync/src/videos/video-index";
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

/** Metadata payload backing the page chrome (counts, category cards, chips). */
export interface VideoMeta {
  counts: VideoCounts;
  lectureCategories: LectureCategoryFacet[];
  /** Popular keyword and tournament searches shown under the video grid. */
  suggestions: VideoSuggestions;
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
  if (params.excludeIds && params.excludeIds.length) {
    conditions.push(notInArray(videos.videoId, params.excludeIds));
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
 * Computes the popular-search chips from SQL: one grouped query for the
 * tournament names in the library, and a single scan that counts every
 * candidate keyword at once.
 *
 * @param db - Drizzle handle.
 * @returns See {@link VideoSuggestions}.
 */
async function suggestionsFromSql(db: any, params: VideoQueryParams = {}): Promise<VideoSuggestions> {
  const keywordSelect: Record<string, SQL<number>> = {};
  const scopeConditions = buildConditions(params, { skipSearch: true });
  SUGGESTED_KEYWORDS.forEach((keyword, index) => {
    // Same all-tokens-must-match rule the search box applies, so a chip's
    // count is exactly what clicking it returns.
    const conditions = searchTokens(keyword).map(
      (token) => sql`${videos.searchText} LIKE ${likePattern(token)} ESCAPE '\\'`,
    );
    const matches = conditions.length > 1 ? and(...conditions)! : conditions[0];
    const scopedMatches = scopeConditions.length > 0 ? and(...scopeConditions, matches)! : matches;
    keywordSelect[`k${index}`] = sql<number>`sum(case when ${scopedMatches} then 1 else 0 end)`;
  });

  const scope = whereClause(scopeConditions);

  const [tournamentRows, keywordRows] = await Promise.all([
    db
      .select({ tournament: videos.tournament, value: count() })
      .from(videos)
      .where(whereClause([...(scope ? [scope] : []), isNotNull(videos.tournament)]))
      .groupBy(videos.tournament),
    db.select(keywordSelect).from(videos),
  ]);

  const keywordCounts: Record<string, number> = {};
  SUGGESTED_KEYWORDS.forEach((keyword, index) => {
    keywordCounts[keyword] = Number(keywordRows?.[0]?.[`k${index}`] ?? 0);
  });

  return {
    keywords: rankKeywordSuggestions(keywordCounts),
    tournaments: rankTournamentSuggestions(
      (tournamentRows as Array<{ tournament: string | null; value: number }>).map((row) => ({
        tournament: row.tournament,
        count: row.value,
      })),
    ),
  };
}

/**
 * Gets popular searches for a particular video-library category. Search text
 * is intentionally ignored: chips describe the category, not a narrowing
 * query the user has already typed.
 */
export async function getVideoSuggestions(params: VideoQueryParams = {}): Promise<VideoSuggestions> {
  const scopedParams = { ...params, q: null };
  const db = await tryGetDb();
  if (db && (await isTableSeeded(db))) {
    try {
      return await suggestionsFromSql(db, scopedParams);
    } catch (error) {
      console.error("videos: SQL suggestions query failed, falling back to JSON", error);
      backendProbe = { ready: false, checkedAt: Date.now() };
    }
  }

  return computeVideoSuggestions(filterVideoRows(await getVideoRowsFromJson(), scopedParams));
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
      const [
        [totalRow],
        sourceRows,
        styleRows,
        [lecturesOnlyRow],
        [topPicksRow],
        categoryRows,
        suggestions,
      ] = await Promise.all([
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
          suggestionsFromSql(db),
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
        suggestions,
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
    suggestions: computeVideoSuggestions(allRows),
    backend: "json",
  };
}

/**
 * Builds the whole-library index the client caches in `localStorage`, or the
 * slice of it that changed since the client last asked.
 *
 * The delta is the point of the `since` cursor: the library is thousands of
 * rows and a megabyte of JSON, and on almost every page load the honest
 * answer to "what changed?" is "nothing". Only the SQL backend can answer it
 * — the JSON assets carry no per-row timestamp — so the JSON fallback returns
 * the whole library with `partial: false`, and the client replaces its cache
 * rather than merging a delta that was never computed.
 *
 * Deletions are not tracked row by row. `total` is the library's true size,
 * so a client whose merged cache is larger (or smaller) than that knows it
 * has drifted and refetches in full. That costs one extra request on the rare
 * page load after a video is pulled, and saves a tombstone table.
 *
 * What moves `updated_at`, and so what a delta carries: the seed's upsert
 * (which stamps every row it writes, so a re-seed makes the next delta the
 * whole library — correct, just not minimal), a view-count resync, and the
 * admin library's edits. The weekly availability pass deliberately does not
 * stamp it: availability is not part of the tuple the grid renders, and
 * stamping it would rewrite every row's timestamp once a week for a field no
 * client reads.
 *
 * @param since - Epoch ms cursor from the client's last sync, or `null` for
 *   a first, whole-library fetch.
 * @returns See {@link VideoIndexResponse}.
 */
export async function getVideoIndex(since: number | null): Promise<VideoIndexResponse> {
  // The cursor the client stores is generated here, before the read, so a row
  // written *during* the read is picked up next time rather than skipped.
  const syncedAt = Date.now();

  const db = await tryGetDb();
  if (db && (await isTableSeeded(db))) {
    try {
      const changedOnly = since !== null && Number.isFinite(since) && since > 0;
      const [rows, totals] = await Promise.all([
        changedOnly
          ? db
              .select()
              .from(videos)
              // `updated_at` is a second-resolution timestamp column, so the
              // cursor is floored to whole seconds; a row written in the same
              // second as the last sync comes back once more rather than
              // being missed.
              .where(gt(videos.updatedAt, new Date(Math.floor(since / 1000) * 1000)))
          : db.select().from(videos),
        db.select({ value: count() }).from(videos),
      ]);

      return {
        version: VIDEO_INDEX_FORMAT_VERSION,
        rows: (rows as VideoRow[]).map(videoRowToIndexTuple),
        partial: changedOnly,
        total: totals[0]?.value ?? 0,
        syncedAt,
        backend: "sql",
      };
    } catch (error) {
      console.error("videos: SQL index query failed, falling back to JSON", error);
      backendProbe = { ready: false, checkedAt: Date.now() };
    }
  }

  const allRows = await getVideoRowsFromJson();
  return {
    version: VIDEO_INDEX_FORMAT_VERSION,
    rows: allRows.map(videoRowToIndexTuple),
    partial: false,
    total: allRows.length,
    syncedAt,
    backend: "json",
  };
}

/** Members of one stacked playlist, in display order. */
export interface VideoStackPage {
  /** Stack members keyed by `stack_key`; a key with no members is omitted. */
  stacks: Record<string, VideoTuple[]>;
  backend: VideoBackend;
}

/** How many stack keys one request may resolve. */
export const MAX_STACK_KEYS = 120;

/**
 * Fetches the full membership of the given stacked playlists.
 *
 * The feed itself only carries the stack key on each row it happens to
 * return, so the companion video is usually missing from the page (a round
 * and its analysis rarely sort next to each other, and the analysis is often
 * filtered out entirely). This resolves the keys on screen to their whole
 * stacks, which is what lets one card flip between them.
 *
 * @param keys - Stack keys, as read off the loaded rows.
 * @returns Members per key, ordered by `stack_position`. See {@link VideoStackPage}.
 */
export async function getVideoStacks(keys: string[]): Promise<VideoStackPage> {
  const wanted = [...new Set(keys.filter(Boolean))].slice(0, MAX_STACK_KEYS);
  if (wanted.length === 0) return { stacks: {}, backend: "sql" };

  const collect = (rows: VideoRow[]): Record<string, VideoTuple[]> => {
    const byKey: Record<string, VideoTuple[]> = {};
    const ordered = [...rows].sort((a, b) => a.stackPosition - b.stackPosition);
    for (const row of ordered) {
      if (!row.stackKey) continue;
      (byKey[row.stackKey] ??= []).push(videoRowToTuple(row));
    }
    // A key whose stack lost a member upstream is no longer a stack; dropping
    // it here keeps the grid from rendering flip arrows over a single video.
    for (const [key, members] of Object.entries(byKey)) {
      if (members.length < 2) delete byKey[key];
    }
    return byKey;
  };

  const db = await tryGetDb();
  if (db && (await isTableSeeded(db))) {
    try {
      const rows = await db.select().from(videos).where(inArray(videos.stackKey, wanted));
      return { stacks: collect(rows as VideoRow[]), backend: "sql" };
    } catch (error) {
      console.error("videos: SQL stack query failed, falling back to JSON", error);
      backendProbe = { ready: false, checkedAt: Date.now() };
    }
  }

  const allRows = await getVideoRowsFromJson();
  const wantedSet = new Set(wanted);
  return {
    stacks: collect(allRows.filter((row) => row.stackKey && wantedSet.has(row.stackKey))),
    backend: "json",
  };
}

/** Index of the fields the watch page reads out of a {@link VideoTuple}. */
const TUPLE = { videoId: 0, title: 1, style: 6, tournament: 7 } as const;

/**
 * Fetches a single video by its YouTube id.
 *
 * @param videoId - YouTube video id.
 * @returns The video in UI tuple form, or `null` when the library has no such
 *   video.
 */
export async function getVideoById(videoId: string): Promise<VideoTuple | null> {
  const page = await getVideoPage({ source: "all", ids: [videoId], limit: 1, offset: 0 });
  return page.videos[0] ?? null;
}

/**
 * Fetches the videos shown under a video on its watch page.
 *
 * Relatedness is ordered by how specific it is: the rest of the same
 * tournament first (the other rounds of a bracket are what a viewer usually
 * wants next), then the same lecture category or debate format, then the
 * most recent videos in the library — each pass topping up the list until it
 * is full, so a video with no tournament and no format still gets a full row.
 *
 * @param video - The video being watched, as a tuple.
 * @param limit - How many related videos to return at most.
 * @returns Related videos in UI tuple form, never including `video` itself.
 */
export async function getRelatedVideos(
  video: VideoTuple,
  limit = 12,
): Promise<VideoTuple[]> {
  const videoId = video[TUPLE.videoId] as string;
  const style = video[TUPLE.style];
  const tournament = video[TUPLE.tournament] as string | null | undefined;

  const passes: VideoQueryParams[] = [];
  // Tournament names are prefixed with the year of the event; searching the
  // bare name keeps the rest of that bracket without excluding other years.
  const tournamentName = tournament ? stripTournamentYear(tournament) : null;
  if (tournamentName) passes.push({ source: "all", q: tournamentName, sort: "Recency" });
  if (typeof style === "number") passes.push({ source: "all", style, sort: "Recency" });
  if (typeof style === "string") {
    passes.push({ source: "all", categoryKey: normalizeCategoryKey(style), sort: "Recency" });
  }
  passes.push({ source: "all", sort: "Recency" });

  const seen = new Set<string>([videoId]);
  const related: VideoTuple[] = [];

  for (const params of passes) {
    if (related.length >= limit) break;
    // Over-fetch by one pass' worth: every row may already be in the list.
    const page = await getVideoPage({ ...params, limit: limit + related.length + 1, offset: 0 });
    for (const candidate of page.videos) {
      const id = candidate[TUPLE.videoId] as string;
      if (seen.has(id)) continue;
      seen.add(id);
      related.push(candidate);
      if (related.length >= limit) break;
    }
  }

  return related;
}
