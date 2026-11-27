/**
 * @fileoverview The topic code of a round video, the first segment of its
 * short address (`/cpd27/shirley/octofinals/…`); see `./video-topic-path` for
 * the scheme.
 *
 * Policy (`vcx`, `cpd`) has one topic a season, so its code is the format and
 * the season's end year. LD and PF change topic during the season, and each
 * topic has a letter in the order `debate-topics.json` lists the season's
 * topics, which is start-month order (`lda23` September, `ldb23` November,
 * `ldc23` January, `ldd23` March). A video has no topic of its own, so the
 * letter is the topic in force in the month it was published: the last one
 * that had started by then.
 * @module lib/video-topic-code
 */

import debateTopics from "@debate-ai/rankings/data/debate-topics.json";
import type { DebateTopicYear, SeasonalTopic } from "@debate-ai/rankings/src/topics/debate-topics";
import type { DebateStyle } from "../types/videos";
import { TOPIC_FORMAT_STYLE, type VideoTopicFormat } from "./video-topic-path";

const LETTERS = "abcdefghij";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Where a month falls in a season, which runs July to June: July is 0. */
function seasonPosition(monthIndex: number): number {
  return (monthIndex + 6) % 12;
}

/** Each seasonal format's topics' start positions, by the year the season ends. */
const START_POSITIONS: Record<"ld" | "pf", Map<number, number[]>> = { ld: new Map(), pf: new Map() };

function positionsOf(topics: SeasonalTopic[] | undefined): number[] {
  return (topics ?? []).slice(0, LETTERS.length).map((topic) => {
    const month = MONTHS.indexOf((topic.start_month ?? "").trim().toLowerCase());
    return month < 0 ? -1 : seasonPosition(month);
  });
}

for (const entry of (debateTopics as { data: DebateTopicYear[] }).data) {
  const year = Number(entry.year);
  if (!Number.isFinite(year)) continue;
  START_POSITIONS.ld.set(year, positionsOf(entry.ld_topics));
  START_POSITIONS.pf.set(year, positionsOf(entry.pf_topics));
}

/** The earliest season whose topic codes have two digits (`vcx00` is 1999-2000). */
export const FIRST_TOPIC_CODE_SEASON = 2000;

/** The last season two digits can name, from {@link FIRST_TOPIC_CODE_SEASON}. */
export const LAST_TOPIC_CODE_SEASON = 2099;

/**
 * The letter of the topic in force when a seasonal format's video was
 * published.
 *
 * @returns `"a"`…, or `null` when the season has no topics on record for the
 *   format, the date does not parse or falls in another season, or a topic's
 *   start month is unreadable.
 */
export function seasonalTopicLetter(format: "ld" | "pf", seasonEnd: number, date: string | null | undefined): string | null {
  const starts = START_POSITIONS[format].get(seasonEnd);
  const published = date ? new Date(date) : null;
  if (!starts || starts.length === 0 || !published || Number.isNaN(published.getTime())) return null;
  if (starts.some((start) => start < 0)) return null;
  if (published.getUTCFullYear() + (published.getUTCMonth() >= 6 ? 1 : 0) !== seasonEnd) return null;
  const position = seasonPosition(published.getUTCMonth());
  let index = 0;
  starts.forEach((start, i) => {
    if (start <= position) index = i;
  });
  return LETTERS[index] ?? null;
}

const STYLE_FORMAT = Object.fromEntries(
  (Object.entries(TOPIC_FORMAT_STYLE) as [VideoTopicFormat, DebateStyle][]).map(([format, style]) => [style, format]),
) as Partial<Record<DebateStyle, VideoTopicFormat>>;

/**
 * The topic code of a video: `cpd27`, `vcx24`, `ldb23`.
 *
 * @param style - The video's numeric debate style.
 * @param seasonEnd - The year its season ends in (`2027` for 2026-27).
 * @param date - Its publish date, which picks the topic of an LD or PF season.
 * @returns The code, or `null` for a format with no topic code (World
 *   Schools, ACC, parli, congress, miscellaneous), a season outside
 *   {@link FIRST_TOPIC_CODE_SEASON}…{@link LAST_TOPIC_CODE_SEASON}, or an LD
 *   or PF video whose topic cannot be told.
 */
export function videoTopicCode(
  style: DebateStyle | string | null | undefined,
  seasonEnd: number | null | undefined,
  date?: string | null,
): string | null {
  if (typeof style !== "number" || !seasonEnd || !Number.isInteger(seasonEnd)) return null;
  if (seasonEnd < FIRST_TOPIC_CODE_SEASON || seasonEnd > LAST_TOPIC_CODE_SEASON) return null;
  const format = STYLE_FORMAT[style as DebateStyle];
  if (!format) return null;
  const yy = String(seasonEnd % 100).padStart(2, "0");
  if (format === "vcx" || format === "cpd") return `${format}${yy}`;
  const letter = seasonalTopicLetter(format, seasonEnd, date);
  return letter ? `${format}${letter}${yy}` : null;
}
