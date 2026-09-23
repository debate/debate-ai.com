/**
 * @fileoverview Decoding for `GET /videos`, whose rows arrive as positional
 * tuples rather than objects.
 *
 * The route sends `[videoId, title, date, channel, viewCount, description,
 * style|category, tournament, roundLevel, affTeam, negTeam, affWin,
 * judgeDecision, arg1AC, arg2NR, isTopPick, speechDocsUrl]` — a deliberate
 * payload saving on a page of sixty videos, and the reason the OpenAPI schema
 * types the row as an untyped array. Naming the positions once, here, is what
 * keeps `VideoLibraryScreen` free of index literals and what lets the decoding
 * be tested without a network call.
 *
 * @module videos
 */

/** One video row, as the grid renders it. */
export interface VideoRow {
  videoId: string;
  title: string;
  date: string;
  channel: string;
  viewCount: number;
  /** Debate format number (1 Policy, 2 PF, 3 LD, 4 College) or a lecture category slug. */
  style: string | number | null;
  tournament: string;
  /** Whether the video is an editorially selected top pick. */
  isTopPick: boolean;
}

/** Tuple positions, in the order `GET /videos` documents them. */
const enum Column {
  VideoId = 0,
  Title = 1,
  Date = 2,
  Channel = 3,
  ViewCount = 4,
  Style = 6,
  Tournament = 7,
  IsTopPick = 15,
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Decodes one positional row. A row shorter than the columns read (an older
 * deployment, or a lecture with no round metadata) yields empty fields rather
 * than `undefined` leaking into the markup.
 */
export function decodeVideoRow(row: unknown[]): VideoRow {
  const style = row[Column.Style];
  return {
    videoId: text(row[Column.VideoId]),
    title: text(row[Column.Title]),
    date: text(row[Column.Date]),
    channel: text(row[Column.Channel]),
    viewCount: Number(row[Column.ViewCount]) || 0,
    style: typeof style === "string" || typeof style === "number" ? style : null,
    tournament: text(row[Column.Tournament]),
    isTopPick: Boolean(row[Column.IsTopPick]),
  };
}

/** Decodes a page of rows, skipping anything that isn't an array. */
export function decodeVideoRows(rows: unknown): VideoRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(Array.isArray).map((row) => decodeVideoRow(row as unknown[]));
}

/** Watch URL for a row — the archive stores YouTube ids. */
export function videoWatchUrl(video: VideoRow): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`;
}

/** `1_200_000` → `1.2M`, so a view count fits a card's footer line. */
export function formatViewCount(views: number): string {
  if (!Number.isFinite(views) || views <= 0) return "—";
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(views));
}

/** Format numbers the archive stores against a round; anything else is a lecture. */
const STYLE_LABELS: Record<number, string> = {
  1: "Policy",
  2: "Public Forum",
  3: "Lincoln-Douglas",
  4: "College",
};

/** Human label for a row's `style` column — a format name, or the lecture slug. */
export function styleLabel(style: VideoRow["style"]): string {
  if (style === null || style === "") return "Lecture";
  const asNumber = Number(style);
  if (Number.isInteger(asNumber) && STYLE_LABELS[asNumber]) return STYLE_LABELS[asNumber];
  // A lecture category slug, e.g. `demo_debates`.
  return String(style).replace(/_/g, " ");
}
