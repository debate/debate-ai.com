/**
 * @fileoverview Turns the curated round records in the root `test/` folder
 * (`video_metadata.json`, `video_metadata_deduplicated.json`) into rows for
 * the admin "Round videos" queue (`youtube_round_videos`).
 *
 * Each record carries a title, an event, a format and argument tags whose
 * resolution tag is the round's topic. The topic and every tag are kept in
 * the queued description, and the tags are split into the 1AC / 2NR
 * arguments (see `round-arguments.ts`) that publishing copies into the
 * public `videos` row.
 * @module @debate/data-sync/videos/curated-round-queue
 */

import { formatRoundArgumentLines, splitRoundArguments } from "../youtube/parsers/round-arguments";
import { parseRoundLevel } from "../youtube/parsers/round-parsers";

/** One record from `test/video_metadata*.json`. */
export interface CuratedRoundRecord {
  record_id: string;
  title: string;
  event: string;
  format: string;
  arguments: string[];
  url: string;
  video_id: string;
  url_arguments?: Record<string, string>;
}

/** What YouTube's keyless oEmbed endpoint says about a video, when reachable. */
export interface CuratedRoundOEmbed {
  title?: string | null;
  author_name?: string | null;
}

/** A `youtube_round_videos` insert row (timestamps left to their defaults). */
export interface CuratedQueueRow {
  id: string;
  title: string;
  publishedAt: string;
  channel: string;
  views: number;
  description: string;
  style: number;
  tournament: string | null;
  roundLevel: string | null;
  aff: string | null;
  neg: string | null;
  winner: null;
  judgeDecision: null;
}

const STYLE_BY_FORMAT: Record<string, number> = { policy: 1, cx: 1, pf: 2, ld: 3, college: 4 };

/** The `Resolved: …` tag, which is the round's topic. */
export function curatedRoundTopic(record: CuratedRoundRecord): string | null {
  return record.arguments.find((tag) => /^resolved\b/i.test(tag.trim()))?.trim() ?? null;
}

/** The queued description: topic, the original tags, then the 1AC / 2NR split. */
export function curatedRoundDescription(record: CuratedRoundRecord): string {
  const topic = curatedRoundTopic(record);
  const tags = record.arguments.map((tag) => tag.trim()).filter((tag) => tag && tag !== topic);
  const lines: string[] = [];
  if (topic) lines.push(`Topic: ${topic}`);
  if (tags.length) lines.push(`Arguments: ${tags.join(", ")}`);
  lines.push(...formatRoundArgumentLines(splitRoundArguments(record.arguments)));
  lines.push(`Event: ${record.event}`);
  return lines.join("\n");
}

/** `"2025 TOC Double Octos"` → `"Doubles"`; `"… Round 9"` → `"R9"`. */
export function curatedRoundLevel(event: string): string | null {
  const normalized = event
    .replace(/\bDouble\s+Octo(?:s|finals?)\b/i, "Doubles")
    .replace(/\bTriple\s+Octo(?:s|finals?)\b/i, "Triples")
    .replace(/\bOctos\b/i, "Octas");
  return parseRoundLevel(normalized);
}

/**
 * `"2025 NDCA National Championship Round 3"` → `"NDCA National Championship"`.
 * A round robin is its own tournament, so `"Harvard Round Robin"` keeps its name.
 */
export function curatedTournament(event: string): string | null {
  const name = event
    .replace(/^\s*\d{4}\s+/, "")
    .replace(
      /\s+(?:Round\s+\d+|R\d+|(?:Double|Triple)\s+Octo(?:s|finals?)|Doubles|Triples|Octos|Octas|Octafinals?|Quarters|Quarterfinals?|Semis|Semifinals?|Finals?|Runoffs?)\s*$/i,
      "",
    )
    .trim();
  return name || null;
}

/** Publish date stand-in: January 1st of the event's year (the records carry no date). */
export function curatedPublishedAt(event: string): string {
  const year = event.match(/\b(19|20)\d{2}\b/)?.[0];
  return `${year ?? "2000"}-01-01`;
}

/** Converts one curated record into a queue row. */
export function curatedRecordToQueueRow(
  record: CuratedRoundRecord,
  oembed?: CuratedRoundOEmbed | null,
): CuratedQueueRow {
  const [aff, neg] = record.title.split(/\s+vs?[.,]?\s+/i).map((team) => team.trim() || null);
  return {
    id: record.video_id,
    title: oembed?.title?.trim() || `${record.event}: ${record.title}`,
    publishedAt: curatedPublishedAt(record.event),
    channel: oembed?.author_name?.trim() || record.url_arguments?.ab_channel || "Unknown",
    views: 0,
    description: curatedRoundDescription(record),
    style: STYLE_BY_FORMAT[record.format.trim().toLowerCase()] ?? 1,
    tournament: curatedTournament(record.event),
    roundLevel: curatedRoundLevel(record.event),
    aff: aff ?? null,
    neg: neg ?? null,
    winner: null,
    judgeDecision: null,
  };
}

/** Keeps the first record per video id, in input order. */
export function uniqueCuratedRecords(records: readonly CuratedRoundRecord[]): CuratedRoundRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (!record.video_id || seen.has(record.video_id)) return false;
    seen.add(record.video_id);
    return true;
  });
}

const QUEUE_COLUMNS = [
  "id",
  "title",
  "published_at",
  "channel",
  "views",
  "description",
  "style",
  "tournament",
  "round_level",
  "aff",
  "neg",
] as const;

function sqlLiteral(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * One SQL statement queueing `row` in `youtube_round_videos`.
 *
 * Skips a video that is already published (`videos`) or that an admin
 * removed (`youtube_video_exclusions`). A video already waiting in the queue
 * keeps its row, and gets the curated description appended unless it already
 * carries the 1AC / 2NR lines, so its topic and arguments still reach the
 * library on publish. A row this import queued itself (its description opens
 * with `Topic: `) has its description rewritten instead, so re-running the
 * import picks up corrected records.
 */
export function buildCuratedQueueStatement(row: CuratedQueueRow): string {
  const values = [
    row.id,
    row.title,
    row.publishedAt,
    row.channel,
    row.views,
    row.description,
    row.style,
    row.tournament,
    row.roundLevel,
    row.aff,
    row.neg,
  ].map(sqlLiteral);
  const id = sqlLiteral(row.id);
  return [
    `INSERT INTO youtube_round_videos (${QUEUE_COLUMNS.join(", ")})`,
    `SELECT ${values.join(", ")}`,
    `WHERE NOT EXISTS (SELECT 1 FROM videos WHERE video_id = ${id})`,
    `AND NOT EXISTS (SELECT 1 FROM youtube_video_exclusions WHERE video_id = ${id})`,
    `ON CONFLICT(id) DO UPDATE SET`,
    `description = CASE WHEN youtube_round_videos.description LIKE 'Topic: %' THEN excluded.description`,
    `WHEN youtube_round_videos.description LIKE '%Neg 2NR args:%' OR youtube_round_videos.description LIKE '%Aff 1AC args:%'`,
    `THEN youtube_round_videos.description`,
    `ELSE trim(youtube_round_videos.description || char(10) || char(10) || excluded.description) END,`,
    `updated_at = unixepoch()`,
  ].join("\n");
}
