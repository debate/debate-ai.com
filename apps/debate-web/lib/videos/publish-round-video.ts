/**
 * @fileoverview Publishes rows from the admin YouTube resync queue
 * (`youtube_round_videos`) into the public `videos` table that `/api/videos`
 * serves from.
 *
 * Mirrors the row shape `debate-data-sync`'s JSON-seeded rows use (see
 * `video-rows.ts`) so a resynced round and a JSON-seeded round are
 * indistinguishable to the public feed once published.
 * @module lib/videos/publish-round-video
 */

import { eq, inArray } from "drizzle-orm";
import { publishedMsForDate, seasonYearForDate } from "@debate/data-sync/src/videos/video-rows";
import { parseQueuedRoundArgs } from "@debate/data-sync/src/youtube/parsers/round-arguments";
import { chunkBoundParams } from "@/lib/database/bound-params";
import { chunkStatements } from "@/lib/database/query-budget";
import {
  videos,
  youtubeRoundVideos,
  type VideoTableInsert,
  type YoutubeRoundVideo,
} from "@/lib/database/schema";
import { recomputeVideoStacks } from "./recompute-video-stacks";

/**
 * Converts one queued round video into a `videos` table insert row. The 1AC /
 * 2NR arguments come from the description's `Aff 1AC args:` / `Neg 2NR args:`
 * lines, which only curated imports carry (see `round-arguments.ts`).
 */
export function roundVideoToVideoRow(row: YoutubeRoundVideo): VideoTableInsert {
  const { arg1ac, arg2nr } = parseQueuedRoundArgs(row.description);
  return {
    videoId: row.id,
    source: "round",
    title: row.title,
    publishedAt: row.publishedAt,
    publishedMs: publishedMsForDate(row.publishedAt),
    channel: row.channel,
    viewCount: row.views,
    description: row.description,
    style: row.style,
    category: null,
    categoryKey: null,
    tournament: row.tournament,
    roundLevel: row.roundLevel,
    affTeam: row.aff,
    negTeam: row.neg,
    affWin: row.winner,
    judgeDecision: row.judgeDecision,
    arg1ac,
    arg2nr,
    isTopPick: false,
    speechDocsUrl: null,
    seasonYear: seasonYearForDate(row.publishedAt),
    searchText: `${row.title} ${row.channel} ${row.description}`.toLowerCase(),
  };
}

/**
 * Upserts queued round videos into the public `videos` table.
 *
 * Every row is written by its own statement, since D1 caps bound parameters
 * per statement and a `videos` row already uses most of that budget. The same
 * cap is why the admin-edited lookup below reads in chunks instead of one
 * `IN (...)` over the whole batch; see `lib/database/bound-params.ts`.
 *
 * Those statements are *sent* in batches, though, rather than awaited one by
 * one. D1 allows a Worker invocation only 1,000 queries (50 on the Free plan)
 * and an awaited statement spends one, so a per-row loop made "Publish all"
 * cost a query per queued round: a queue big enough — which is the whole
 * point of that endpoint — crossed the ceiling mid-loop and failed at the
 * driver, with a stack that stops inside the D1 client and names neither the
 * table nor the round. A batch is one query however many statements it
 * carries, so the cost is now the queue's length divided by
 * `DEFAULT_STATEMENTS_PER_BATCH`, and the upserts apply as one transaction
 * instead of leaving a half-published queue behind when something fails
 * partway. See `lib/database/query-budget.ts`.
 *
 * The weekly/manual resync (`lib/youtube/resync-rounds.ts`) re-walks every
 * subscribed channel's uploads since a cutoff floor on every run (default
 * `2023-05-01`, overridable per-run from the admin page's date chooser) — with
 * no check against `videos` — only an explicit admin removal
 * (`youtube_video_exclusions`) keeps a video out of the queue. So a round
 * published days or months ago can resurface in `youtube_round_videos` and
 * reach this function again, computed fresh from the YouTube listing. The
 * already-published row always wins: {@link loadLibraryKeys} re-reads the
 * library's ids and titles immediately before writing, any row matching one
 * by normalized YouTube id or by title (see {@link dedupeRoundQueue}) is
 * skipped, duplicates within `rows` keep only the oldest upload, and the
 * insert itself is `ON CONFLICT DO NOTHING` as a backstop. An older published row may carry an admin's correction
 * (`admin_edited`), a hand-cut stack placement, or round data parsed when the
 * listing was cleaner — none of which a recomputed resync row should replace.
 * The admin page's "Deduplicate" button ({@link dedupeRoundQueue}) clears
 * those already-published rounds out of the queue without publishing.
 *
 * Newly published rows carry no stack placement of their own — the resync
 * queue's rows are never run through `assignVideoStacks` — so once every row
 * is written, {@link recomputeVideoStacks} re-derives stacking for the whole
 * table. This is what lets a round published today link up with an analysis
 * published (or resynced) weeks earlier, and vice versa; see that module's
 * fileoverview for why a per-batch computation cannot find that link on its
 * own.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite in development).
 * @param rows - Queued round videos to publish.
 * @returns Number of rows actually inserted — excludes any left untouched
 *   because they were already published.
 */
export async function publishRoundVideos(db: any, rows: YoutubeRoundVideo[]): Promise<number> {
  const library = await loadLibraryKeys(db);

  let published = 0;
  const inserts = [];
  // Oldest upload first, so when two queued rows are the same video (or a
  // re-upload under the same title) the older one is the one published.
  const seen = { ids: new Set<string>(), titles: new Set<string>() };
  for (const row of oldestFirst(rows)) {
    if (isDuplicate(row, library) || isDuplicate(row, seen)) continue;
    remember(row, seen);
    // Unexecuted — a drizzle query builder only runs when it is awaited, which
    // is what lets `db.batch()` take it. Both the D1 driver and the local
    // libSQL driver `getDB()` can return support `.batch()`.
    inserts.push(db.insert(videos).values(roundVideoToVideoRow(row)).onConflictDoNothing());
    published++;
  }
  for (const batch of chunkStatements(inserts)) await db.batch(batch);

  if (published > 0) await recomputeVideoStacks(db);

  return published;
}

/** Matches the 11-character id inside any common YouTube URL shape. */
const YOUTUBE_URL_ID =
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

/**
 * Canonical form of a YouTube video id: trimmed, and pulled out of a watch,
 * `youtu.be`, shorts, live or embed URL when one was stored instead of the
 * bare id. Ids are case-sensitive on YouTube, so case is left alone.
 */
export function normalizeYoutubeId(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  return value.match(YOUTUBE_URL_ID)?.[1] ?? value;
}

/**
 * Shortest normalized title trusted as a duplicate signal on its own — below
 * this a title is too generic ("Finals", "Round 1") to say two uploads are
 * the same round.
 */
const MIN_TITLE_KEY_LENGTH = 12;

/**
 * Comparison key for a video title: lowercased, punctuation folded to spaces
 * and whitespace collapsed, so a re-upload under the same title still matches.
 * Empty when the title is too short to trust (see {@link MIN_TITLE_KEY_LENGTH}).
 */
export function normalizeVideoTitle(title: string | null | undefined): string {
  const key = (title ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return key.length >= MIN_TITLE_KEY_LENGTH ? key : "";
}

interface DedupeKeys {
  ids: Set<string>;
  titles: Set<string>;
}

function isDuplicate(row: Pick<YoutubeRoundVideo, "id" | "title">, keys: DedupeKeys): boolean {
  const title = normalizeVideoTitle(row.title);
  return keys.ids.has(normalizeYoutubeId(row.id)) || (title !== "" && keys.titles.has(title));
}

function remember(row: Pick<YoutubeRoundVideo, "id" | "title">, keys: DedupeKeys): void {
  keys.ids.add(normalizeYoutubeId(row.id));
  const title = normalizeVideoTitle(row.title);
  if (title) keys.titles.add(title);
}

/** Oldest upload first; ties broken by when the row was queued, then by id. */
function oldestFirst<T extends Pick<YoutubeRoundVideo, "id" | "publishedAt" | "createdAt">>(rows: T[]): T[] {
  const queuedMs = (row: T) => (row.createdAt instanceof Date ? row.createdAt.getTime() : 0);
  return [...rows].sort(
    (a, b) =>
      (a.publishedAt ?? "").localeCompare(b.publishedAt ?? "") ||
      queuedMs(a) - queuedMs(b) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Every published video's normalized YouTube id and title. One full-table
 * read of two narrow columns rather than an `IN (...)` lookup: matching on a
 * normalized id or a title can't be expressed as an equality on the stored
 * `video_id`, and one read is also cheaper against D1's per-invocation query
 * ceiling than a chunked lookup; see `lib/database/query-budget.ts`.
 */
async function loadLibraryKeys(db: any): Promise<DedupeKeys> {
  const rows: { videoId: string; title: string }[] = await db
    .select({ videoId: videos.videoId, title: videos.title })
    .from(videos);
  const keys: DedupeKeys = { ids: new Set(), titles: new Set() };
  for (const row of rows) remember({ id: row.videoId, title: row.title }, keys);
  return keys;
}

/**
 * Returns which of `ids` already have a row in the public `videos` table.
 *
 * One statement per 100 ids: `videoId IN (...)` binds a parameter per id and
 * D1 rejects a statement past that. "Publish all" over a queue holding more
 * than 100 rounds used to fail right here, before a single row was written.
 * The statements go out in batches so the lookup costs a handful of D1
 * queries rather than one per chunk; see `lib/database/query-budget.ts`.
 */
export async function findPublishedVideoIds(db: any, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (ids.length === 0) return found;
  const lookups = chunkBoundParams(ids).map((idChunk) =>
    db.select({ videoId: videos.videoId }).from(videos).where(inArray(videos.videoId, idChunk)),
  );
  for (const batch of chunkStatements(lookups)) {
    // One result array per statement, in the order the statements were given.
    for (const existing of (await db.batch(batch)) as { videoId: string }[][]) {
      for (const row of existing) found.add(row.videoId);
    }
  }
  return found;
}

/**
 * Removes every queued round that duplicates a published video or an older
 * queued round, leaving the published row untouched — the admin page's
 * "Deduplicate" action. Optionally narrowed to one style, matching the queue
 * filter the admin is looking at.
 *
 * Two rows are the same video when their YouTube ids match after
 * {@link normalizeYoutubeId} (a stored URL or stray whitespace no longer hides
 * a match), or when their titles match after {@link normalizeVideoTitle} (a
 * re-upload of the same round under a new id). The older copy always wins: a
 * published row is never overwritten, and between two queued rows the earlier
 * upload stays in the queue.
 *
 * @returns The ids removed from the queue.
 */
export async function dedupeRoundQueue(db: any, style?: number | null): Promise<string[]> {
  const queued: Pick<YoutubeRoundVideo, "id" | "title" | "publishedAt" | "createdAt">[] = await db
    .select({
      id: youtubeRoundVideos.id,
      title: youtubeRoundVideos.title,
      publishedAt: youtubeRoundVideos.publishedAt,
      createdAt: youtubeRoundVideos.createdAt,
    })
    .from(youtubeRoundVideos)
    .where(style == null ? undefined : eq(youtubeRoundVideos.style, style));
  const library = await loadLibraryKeys(db);

  const kept: DedupeKeys = { ids: new Set(), titles: new Set() };
  const duplicates: string[] = [];
  for (const row of oldestFirst(queued)) {
    if (isDuplicate(row, library) || isDuplicate(row, kept)) duplicates.push(row.id);
    else remember(row, kept);
  }

  const clears = chunkBoundParams<string>(duplicates).map((idChunk) =>
    db.delete(youtubeRoundVideos).where(inArray(youtubeRoundVideos.id, idChunk)),
  );
  for (const batch of chunkStatements(clears)) await db.batch(batch);
  return duplicates;
}
