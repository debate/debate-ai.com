/**
 * @fileoverview Conversion between the compact video tuples stored in the
 * `data/videos/*.json` assets and the flat row shape used by the `videos`
 * SQL table (local SQLite in development, Cloudflare D1 in production).
 *
 * The JSON files remain the source of truth that the YouTube sync writes to;
 * the SQL table is the queryable projection of them that the paginated
 * `/api/videos` endpoint serves from.
 * @module videos/video-rows
 */

/**
 * Positional video record as stored in the JSON assets and consumed by the UI.
 *
 * `[videoId, title, date, channel, viewCount, description, style|category,
 *   tournament, roundLevel, affTeam, negTeam, affWin, judgeDecision, arg1AC,
 *   arg2NR, isTopPick, speechDocsUrl]`
 */
export type VideoTuple = any[];

/** Which JSON asset family a row was ingested from. */
export type VideoSource = "round" | "lecture";

/** Flat, column-per-field representation of a single video. */
export interface VideoRow {
  /** YouTube video id — primary key. */
  videoId: string;
  /** `"round"` for the `rounds-*.json` assets, `"lecture"` for `debate-lectures.json`. */
  source: VideoSource;
  title: string;
  /** Publish date string exactly as stored in the JSON, usually `YYYY-MM-DD`. */
  publishedAt: string;
  /**
   * {@link VideoRow.publishedAt} parsed to epoch milliseconds (`0` when
   * unparseable). Recency sorting orders by this, because a few rows carry
   * long-form dates that would sort wrongly as text.
   */
  publishedMs: number;
  channel: string;
  viewCount: number;
  description: string;
  /** Numeric debate style (1 Policy, 2 PF, 3 LD, 4 College); `null` for lectures. */
  style: number | null;
  /** Lecture category label (e.g. `"Demo Debates"`); `null` for rounds. */
  category: string | null;
  /** URL-safe form of {@link VideoRow.category}, e.g. `"demo_debates"`. */
  categoryKey: string | null;
  tournament: string | null;
  roundLevel: string | null;
  affTeam: string | null;
  negTeam: string | null;
  affWin: boolean | null;
  judgeDecision: string | null;
  arg1ac: string | null;
  arg2nr: string | null;
  /** Whether the video is flagged as a top pick (tuple flag or top-picks list). */
  isTopPick: boolean;
  speechDocsUrl: string | null;
  /**
   * Competition season the publish date falls in — the season runs from
   * June 1st of `year - 1` to June 1st of `year`. `0` marks legacy content
   * published before June 1st 2010 (and unparseable dates).
   */
  seasonYear: number;
  /** Lowercased `title + channel + description`, used for `LIKE` search. */
  searchText: string;
}

/** Season boundary: everything published before this date is "legacy". */
export const LEGACY_CUTOFF = "2010-06-01";

/** Sentinel {@link VideoRow.seasonYear} value for pre-2010 (legacy) videos. */
export const LEGACY_SEASON = 0;

/**
 * Normalizes a lecture category label into the URL slug used by
 * `/videos/[category]` and the category gallery cards.
 *
 * @param label - Human-readable category label.
 * @returns Lowercased key with whitespace, `&` and `/` collapsed to underscores.
 */
export function normalizeCategoryKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[&/]/g, "_");
}

/**
 * Parses a publish date to epoch milliseconds.
 *
 * @param date - Publish date string; anything `Date` can parse.
 * @returns Epoch milliseconds, or `0` when the date cannot be parsed.
 */
export function publishedMsForDate(date: string): number {
  const time = new Date(date).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Maps a publish date onto its competition season.
 *
 * @param date - Publish date string; anything `Date` can parse.
 * @returns The season year, or {@link LEGACY_SEASON} for pre-2010 / invalid dates.
 */
export function seasonYearForDate(date: string): number {
  const parsed = new Date(date);
  const time = parsed.getTime();
  if (Number.isNaN(time)) return LEGACY_SEASON;
  if (time < new Date(LEGACY_CUTOFF).getTime()) return LEGACY_SEASON;
  // Months are 0-indexed: June (5) starts the next season.
  return parsed.getUTCFullYear() + (parsed.getUTCMonth() >= 5 ? 1 : 0);
}

/** Coerces a tuple slot into a trimmed string, or `null` when absent/blank. */
function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Strips a leading tournament year (e.g. `"2019 Loyola"` -> `"Loyola"`). The
 * source JSON prefixes most round tournament names with the calendar year of
 * the event; that year is redundant now that {@link seasonYearForDate} backs
 * a dedicated season column, so it is dropped here rather than shown twice.
 */
export function stripTournamentYear(value: string | null): string | null {
  if (!value) return value;
  const stripped = value.replace(/^\s*(19|20)\d{2}\s+/, "").trim();
  return stripped.length > 0 ? stripped : null;
}

/**
 * Formats a {@link VideoRow.seasonYear} as the `"24-25"` label the UI shows,
 * or `"Legacy"` for {@link LEGACY_SEASON}.
 */
export function formatSeasonLabel(seasonYear: number): string {
  if (!seasonYear) return "Legacy";
  const end = seasonYear % 100;
  const start = (seasonYear - 1) % 100;
  return `${String(start).padStart(2, "0")}-${String(end).padStart(2, "0")}`;
}

/**
 * Converts one JSON tuple into a {@link VideoRow}.
 *
 * @param tuple - Positional record from a `data/videos/*.json` asset.
 * @param source - Which asset family the tuple came from.
 * @param topPickIds - Ids listed in `debate-top-picks.json`.
 * @returns The flat row, or `null` when the tuple carries no video id.
 */
export function tupleToVideoRow(
  tuple: VideoTuple,
  source: VideoSource,
  topPickIds?: Set<string>,
): VideoRow | null {
  const videoId = typeof tuple?.[0] === "string" ? tuple[0].trim() : "";
  if (!videoId) return null;

  const styleOrCategory = tuple[6];
  const style = typeof styleOrCategory === "number" ? styleOrCategory : null;
  const category = typeof styleOrCategory === "string" ? str(styleOrCategory) : null;
  const title = typeof tuple[1] === "string" ? tuple[1] : "";
  const channel = typeof tuple[3] === "string" ? tuple[3] : "";
  const description = typeof tuple[5] === "string" ? tuple[5] : "";
  const publishedAt = typeof tuple[2] === "string" ? tuple[2] : "";

  return {
    videoId,
    source,
    title,
    publishedAt,
    publishedMs: publishedMsForDate(publishedAt),
    channel,
    viewCount: typeof tuple[4] === "number" ? tuple[4] : 0,
    description,
    style,
    category,
    categoryKey: category ? normalizeCategoryKey(category) : null,
    tournament: stripTournamentYear(str(tuple[7])),
    roundLevel: str(tuple[8]),
    affTeam: str(tuple[9]),
    negTeam: str(tuple[10]),
    affWin: typeof tuple[11] === "boolean" ? tuple[11] : null,
    judgeDecision: str(tuple[12]),
    arg1ac: str(tuple[13]),
    arg2nr: str(tuple[14]),
    isTopPick: tuple[15] === true || !!topPickIds?.has(videoId),
    speechDocsUrl: str(tuple[16]),
    seasonYear: seasonYearForDate(publishedAt),
    searchText: `${title} ${channel} ${description}`.toLowerCase(),
  };
}

/**
 * Converts a row back into the positional tuple the video UI expects.
 *
 * Trailing empty slots are dropped so paged responses stay small; the UI reads
 * missing indices as `undefined`, which is how short tuples already behave in
 * the JSON assets. `seasonYear` (tuple index 17) is always kept, so it stops
 * the trim at index 18 for every row — a single extra number is a cheap
 * trade-off for a sortable, displayable season on every video.
 *
 * @param row - Flat row, typically a `videos` table record.
 * @returns The positional tuple, trimmed to its last meaningful slot.
 */
export function videoRowToTuple(row: VideoRow): VideoTuple {
  const tuple: VideoTuple = [
    row.videoId,
    row.title,
    row.publishedAt,
    row.channel,
    row.viewCount,
    row.description,
    row.style ?? row.category ?? null,
    // Defensively re-stripped here (not just in `tupleToVideoRow`) so rows
    // seeded before `stripTournamentYear` existed still render clean.
    stripTournamentYear(row.tournament),
    row.roundLevel,
    row.affTeam,
    row.negTeam,
    row.affWin,
    row.judgeDecision,
    row.arg1ac,
    row.arg2nr,
    row.isTopPick || null,
    row.speechDocsUrl,
    row.seasonYear,
  ];

  // Keep the first seven slots (the fields every consumer reads) and drop
  // trailing nulls so a 100-video page does not ship thousands of `null`s.
  let end = tuple.length;
  while (end > 7 && (tuple[end - 1] === null || tuple[end - 1] === undefined)) end--;
  return tuple.slice(0, end);
}

/** A `data/videos/*.json` asset: a `data` array of tuples. */
export interface VideoAsset {
  data: VideoTuple[];
}

/** The JSON assets that make up the video library. */
export interface VideoAssets {
  /** Round assets — `rounds-policy`, `rounds-pf`, `rounds-ld`, `rounds-college`. */
  rounds: VideoAsset[];
  /** The lectures asset. */
  lectures: VideoAsset;
  /** `debate-top-picks.json` — a flat array of video ids. */
  topPicks: { data: string[] };
}

/**
 * Builds the full de-duplicated row set from the JSON assets.
 *
 * Rounds are ingested first, so a video appearing in both a rounds asset and
 * the lectures asset keeps its round metadata — matching the existing
 * `dedupeById` behaviour of the old `/api/videos` response.
 *
 * @param assets - See {@link VideoAssets}.
 * @returns One row per unique video id, in ingest order.
 */
export function buildVideoRows(assets: VideoAssets): VideoRow[] {
  const topPickIds = new Set(assets.topPicks?.data ?? []);
  const byId = new Map<string, VideoRow>();

  const ingest = (tuples: VideoTuple[], source: VideoSource) => {
    for (const tuple of tuples) {
      const row = tupleToVideoRow(tuple, source, topPickIds);
      if (row && !byId.has(row.videoId)) byId.set(row.videoId, row);
    }
  };

  for (const asset of assets.rounds) ingest(asset?.data ?? [], "round");
  ingest(assets.lectures?.data ?? [], "lecture");

  return [...byId.values()];
}
