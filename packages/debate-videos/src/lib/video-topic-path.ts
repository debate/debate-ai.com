/**
 * @fileoverview The `/<topic code>/<tournament>/<round>/<teams>` address of a
 * round, e.g. `/cpd27/shirley/octofinals/kansas-ss-harvard-ab/1nc/llm` — the
 * short form of `/videos/26-27/cpd/shirley/octofinals/kansas-ss-harvard-ab/…`.
 *
 * The first segment is a topic code: the format, for the seasonal formats
 * (LD, PF) the letter of the topic within the season, and the two digits of
 * the year the season ends in (`cpd27` is the 2026-27 college policy season,
 * `ldb23` the November LD topic of 2022-23). It is the same scheme as a Topic
 * Starter's code (`@debate-ai/reason-docs` `lib/reason-docs/topic-doc-paths`),
 * with `cpd` — the video library's name for college policy — in place of
 * `ndt`.
 *
 * | Format | Code | Example |
 * | --- | --- | --- |
 * | High-school policy | `vcx<yy>` | `vcx24` |
 * | College policy | `cpd<yy>` | `cpd27` |
 * | Lincoln-Douglas | `ld<a-f><yy>` | `ldb23` |
 * | Public Forum | `pf<a-j><yy>` | `pfa27` |
 *
 * This module is only the shape of the address, with no data and no imports,
 * because the app shell checks every navigation against it and the Worker's
 * config repeats {@link VIDEO_TOPIC_CODE_SOURCE}. `./video-topic-code` builds
 * a video's code.
 *
 * ## Sharing the first segment with Topic Starters
 *
 * `/vcx27/aff/aff-k/k-aff-answers` is a Topic Starter (a file in the Debate
 * Editor) and `/vcx27/shirley/octofinals/kansas-ss-harvard-ab` a round, under
 * the same code. A round's address has a tournament, a round and teams after
 * the code (at most six segments with a variant and a speech and view), and
 * its tournament is never one of the roots a Topic Starter tree opens with
 * ({@link TOPIC_STARTER_ROOTS}); anything else under a code is a Topic
 * Starter. {@link isVideoRoundPath} is that test, and `next.config.mjs`
 * carries the same one in its rewrite.
 * @module lib/video-topic-path
 */

import type { DebateStyle } from "../types/videos";

/**
 * A video topic code's shape as a regex source, unanchored. `next.config.mjs`
 * carries the same pattern in its rewrite (a test keeps the two equal).
 */
export const VIDEO_TOPIC_CODE_SOURCE = "(?:vcx|cpd)\\d{2}|ld[a-f]\\d{2}|pf[a-j]\\d{2}";

const VIDEO_TOPIC_CODE_RE = new RegExp(`^(?:${VIDEO_TOPIC_CODE_SOURCE})$`, "i");

/** The formats a video topic code names. */
export type VideoTopicFormat = "vcx" | "cpd" | "ld" | "pf";

/** The numeric debate style each code format files its videos under. */
export const TOPIC_FORMAT_STYLE: Record<VideoTopicFormat, DebateStyle> = {
  vcx: 1,
  pf: 2,
  ld: 3,
  cpd: 4,
};

/**
 * The first segments a Topic Starter's file path opens with, which a
 * tournament never is: a case's side. `/vcx27/aff/…` is the Debate Editor.
 */
export const TOPIC_STARTER_ROOTS: ReadonlySet<string> = new Set(["aff", "neg", "pro", "con"]);

/** Fewest segments after the code a round has: tournament, round, teams. */
export const MIN_ROUND_SEGMENTS = 3;

/** Most: those, a variant, and a speech and its view. */
export const MAX_ROUND_SEGMENTS = 6;

/** Whether `segment` is shaped like a video topic code (any case). */
export function isVideoTopicCode(segment: string | null | undefined): segment is string {
  return !!segment && VIDEO_TOPIC_CODE_RE.test(segment);
}

/** A topic code read back. */
export interface ParsedVideoTopicCode {
  /** The code, lower-cased. */
  code: string;
  format: VideoTopicFormat;
  /** The topic's letter within the season (`b` in `ldb23`); `null` for policy. */
  letter: string | null;
  /** The year the season ends in: `2027` for `cpd27`. */
  seasonEnd: number;
}

/**
 * Reads a topic code.
 *
 * @returns The format, letter and season, or `null` for a segment that is not
 *   a video topic code. Two digits name a year from 2000: the library's topics
 *   begin with 1999-2000 (`vcx00`).
 */
export function parseVideoTopicCode(segment: string | null | undefined): ParsedVideoTopicCode | null {
  if (!isVideoTopicCode(segment)) return null;
  const code = segment.toLowerCase();
  const match = /^(vcx|cpd|ld|pf)([a-j]?)(\d{2})$/.exec(code);
  if (!match) return null;
  return {
    code,
    format: match[1] as VideoTopicFormat,
    letter: match[2] || null,
    seasonEnd: 2000 + Number(match[3]),
  };
}

/** A round's path read back: its topic code and the segments after it. */
export interface VideoRoundPath {
  /** The first segment, lower-cased. */
  code: string;
  /** The segments after it: tournament, round, teams, then any variant and speech. */
  rest: string[];
}

/**
 * Reads `/<topic code>/<tournament>/<round>/<teams>…` off a pathname.
 *
 * @returns The code and the segments after it, or `null` for any other path —
 *   a Topic Starter (`/vcx27/aff/…`, `/vcx27`), a page, a personal file.
 */
export function parseVideoRoundPath(pathname: string | null | undefined): VideoRoundPath | null {
  if (!pathname) return null;
  const path = (pathname.split("?")[0]?.split("#")[0] ?? "").replace(/\/+$/, "");
  if (!path.startsWith("/")) return null;
  const [code, ...rest] = path.slice(1).split("/");
  if (!isVideoTopicCode(code)) return null;
  if (rest.length < MIN_ROUND_SEGMENTS || rest.length > MAX_ROUND_SEGMENTS) return null;
  if (rest.some((segment) => !segment)) return null;
  let tournament = rest[0];
  try {
    tournament = decodeURIComponent(tournament);
  } catch {
    // A malformed escape is compared as written.
  }
  if (TOPIC_STARTER_ROOTS.has(tournament.toLowerCase())) return null;
  return { code: code.toLowerCase(), rest };
}

/** True on a round's short address (`/cpd27/shirley/octofinals/kansas-ss-harvard-ab`). */
export function isVideoRoundPath(pathname: string | null | undefined): boolean {
  return parseVideoRoundPath(pathname) != null;
}
