/**
 * @fileoverview YouTube view statistics for the video library, computed in SQL.
 *
 * `/api/youtube-stats` used to serve `packages/debate-videos-admin/data/
 * youtube-stats.json`, a snapshot the `youtube-stats` CLI rebuilt from the JSON
 * video assets and that went stale the moment the weekly view-count resync ran.
 * The same totals now come straight from the `videos` table with `GROUP BY`
 * queries, so the charts always match the library.
 *
 * Shape (unchanged for the charts in `@debate-ai/videos`):
 * - `summary` — total views, videos, channels and debate styles;
 * - `byChannel` — per channel, most viewed first;
 * - `byDebateStyle` — per lecture category, or numeric round style
 *   (`"1"` Policy … `"4"` College) for rounds;
 * - `byYear` — per publish year, oldest first;
 * - `byElimRound` — rounds whose title names an elimination round, in bracket
 *   order (Finals first).
 *
 * Videos YouTube no longer serves (`availability` other than `available`) are
 * left out, so a takedown stops counting toward the totals.
 *
 * @module lib/videos/youtube-stats
 */

import { sql } from "drizzle-orm";

/** Views and video count for one group, with the rounded average. */
export interface ViewTotals {
  totalViews: number;
  videoCount: number;
  avgViewsPerVideo: number;
}

/** `GET /api/youtube-stats` response. */
export interface YouTubeStats {
  summary: {
    totalViews: number;
    totalVideos: number;
    totalChannels: number;
    totalDebateStyles: number;
  };
  byChannel: Array<{ channel: string } & ViewTotals>;
  byDebateStyle: Array<{ debateStyle: string } & ViewTotals>;
  byYear: Array<{ year: string } & ViewTotals>;
  byElimRound: Array<{ round: string } & ViewTotals>;
}

/** Elimination rounds in bracket order, with the label the chart shows. */
export const ELIM_ROUNDS = [
  { key: "final", label: "Finals" },
  { key: "semis", label: "Semifinals" },
  { key: "quarters", label: "Quarterfinals" },
  { key: "octas", label: "Octafinals" },
  { key: "doubles", label: "Double Octafinals" },
  { key: "triples", label: "Triple Octafinals" },
] as const;

/** Only rows YouTube still serves. */
const AVAILABLE = sql`availability = 'available'`;

/**
 * The elimination round a round's title names, or NULL. Checked most specific
 * first: "Double Octafinals" also contains "octa", and "Semifinals" and
 * "Quarterfinals" both contain "final".
 */
const ELIM_ROUND_SQL = sql`CASE
  WHEN source <> 'round' THEN NULL
  WHEN lower(title) LIKE '%triple%' THEN 'triples'
  WHEN lower(title) LIKE '%double%' THEN 'doubles'
  WHEN lower(title) LIKE '%octa%' OR lower(title) LIKE '%octo%' THEN 'octas'
  WHEN lower(title) LIKE '%quarter%' THEN 'quarters'
  WHEN lower(title) LIKE '%semi%' THEN 'semis'
  WHEN lower(title) LIKE '%final%' THEN 'final'
  ELSE NULL
END`;

/** Lecture category, else the round's numeric style, else `unknown`. */
const DEBATE_STYLE_SQL = sql`COALESCE(NULLIF(category, ''), CAST(style AS TEXT), 'unknown')`;

/** Publish year from the parsed timestamp; `unknown` when the date didn't parse. */
const YEAR_SQL = sql`CASE WHEN published_ms > 0
  THEN strftime('%Y', published_ms / 1000, 'unixepoch')
  ELSE 'unknown' END`;

type GroupRow = { k: string | null; views: number | string | null; n: number | string };

/** Runs one `GROUP BY` over the available videos. */
async function groupTotals(db: any, keySql: ReturnType<typeof sql>, extraWhere?: ReturnType<typeof sql>): Promise<GroupRow[]> {
  const where = extraWhere ? sql`${AVAILABLE} AND ${extraWhere}` : AVAILABLE;
  return db.all(sql`
    SELECT ${keySql} AS k, SUM(view_count) AS views, COUNT(*) AS n
    FROM videos
    WHERE ${where}
    GROUP BY k
  `);
}

/** Turns a SQL row into `{ totalViews, videoCount, avgViewsPerVideo }`. */
function totals(row: GroupRow): ViewTotals {
  const totalViews = Number(row.views) || 0;
  const videoCount = Number(row.n) || 0;
  return {
    totalViews,
    videoCount,
    avgViewsPerVideo: videoCount ? Math.round(totalViews / videoCount) : 0,
  };
}

/**
 * Computes the library's YouTube view statistics from the `videos` table.
 *
 * @param db - Drizzle handle (D1 in production, libSQL in development).
 * @returns The stats the `/practice/statistics` charts and the videos-page
 *   stats modal read.
 */
export async function getYouTubeStats(db: any): Promise<YouTubeStats> {
  const [channels, styles, years, elims] = await Promise.all([
    groupTotals(db, sql`channel`),
    groupTotals(db, DEBATE_STYLE_SQL),
    groupTotals(db, YEAR_SQL),
    groupTotals(db, ELIM_ROUND_SQL, sql`source = 'round'`),
  ]);

  const byViewsDesc = (a: ViewTotals, b: ViewTotals) => b.totalViews - a.totalViews;

  const byChannel = channels
    .map((row) => ({ channel: String(row.k ?? ""), ...totals(row) }))
    .sort(byViewsDesc);
  const byDebateStyle = styles
    .map((row) => ({ debateStyle: String(row.k ?? "unknown"), ...totals(row) }))
    .sort(byViewsDesc);
  const byYear = years
    .map((row) => ({ year: String(row.k ?? "unknown"), ...totals(row) }))
    .sort((a, b) => a.year.localeCompare(b.year));

  const elimByKey = new Map(elims.filter((row) => row.k).map((row) => [String(row.k), totals(row)]));
  const byElimRound = ELIM_ROUNDS.flatMap(({ key, label }) => {
    const found = elimByKey.get(key);
    return found ? [{ round: label, ...found }] : [];
  });

  return {
    summary: {
      totalViews: byChannel.reduce((sum, c) => sum + c.totalViews, 0),
      totalVideos: byChannel.reduce((sum, c) => sum + c.videoCount, 0),
      totalChannels: byChannel.length,
      totalDebateStyles: byDebateStyle.length,
    },
    byChannel,
    byDebateStyle,
    byYear,
    byElimRound,
  };
}
