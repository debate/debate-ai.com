/**
 * @fileoverview Turns what a followed team or school did into news-feed
 * items: its latest rounds, its latest caselist research, a result line per
 * tournament, and a monthly recap (record, deep elim runs, rating change).
 *
 * Everything here is pure: `hooks/useFollowingNews.ts` fetches the rounds
 * (`/api/videos`), the caselist documents (`/api/caselist-documents`) and the
 * rankings, then calls {@link buildFollowNews} once per follow.
 *
 * Rounds come from the video library, so a tournament's record counts only
 * the rounds someone recorded, and a round is dated by its upload. The
 * rankings are one season-long snapshot with no history, so a month's rating
 * change is estimated: each decided round moves the rating by
 * `K × (result − expected)`, the expected score coming from both teams'
 * current ratings (`winProbability`).
 * @module lib/follows/follow-feed
 */

import {
  RATING_DIVISOR,
  winProbability,
  type RankingDataset,
} from "@debate/rankings-adapter";
import { phraseInText, competitorPhrases } from "@debate/data-sync/src/videos/video-query";
import {
  formatRoundLevel,
  standardizeRoundLevel,
  type StandardRoundLevel,
} from "@debate/data-sync/src/youtube/parsers/round-level";
import type { VideoType } from "../../types/videos";
import { videoRouteHref } from "../video-route";
import { findVideoTeamRanking } from "../../panels/leaderboard/profile/rankingProfileHelpers";
import { followHref, type ProfileFollow } from "./profile-follows";

/** A news-feed item about a followed profile; the shape of `@debate/community`'s `NewsItem`. */
export interface FollowNewsItem {
  id: string;
  category: "following";
  title: string;
  body: string;
  /** Epoch milliseconds (UTC). */
  timestamp: number;
  href?: string;
}

/** The slice of a `/api/caselist-documents` row the feed reads. */
export interface FollowResearchDoc {
  id: number;
  caselistLabel: string;
  school: string;
  team: string | null;
  side: string | null;
  fileName: string;
  cardCount: number;
  /** Epoch seconds. */
  ingestedAt: number;
}

/** What to build a follow's news from. */
export interface FollowNewsInput {
  follow: ProfileFollow;
  /** Phrases the follow's rounds were searched by (`teamVideoSearch`/`schoolVideoSearch`). */
  competitors: string[];
  /** The follow's rounds, any order. */
  rounds: VideoType[];
  docs: FollowResearchDoc[];
  /** Loaded rankings, for the rating estimate; empty skips it. */
  datasets: readonly RankingDataset[];
  now: number;
}

/** Latest rounds posted per follow. */
export const ROUNDS_PER_FOLLOW = 3;
/** Latest research documents posted per follow. */
export const DOCS_PER_FOLLOW = 2;
/** Tournament results older than this stop being posted. */
export const RESULT_WINDOW_MS = 120 * 24 * 60 * 60 * 1000;
/** Completed months a recap is posted for. */
export const RECAP_MONTHS = 3;
/** Elo-style step per decided round, in upstream rating points. */
export const RATING_K = 32;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** How deep into elims a round level is; 0 for a prelim or an unknown round. */
const ELIM_DEPTH: Partial<Record<StandardRoundLevel, number>> = {
  RUNOFFS: 1,
  TRIPLES: 2,
  DOUBLES: 3,
  OCTOS: 4,
  QUARTERS: 5,
  SEMIS: 6,
  FINALS: 7,
};

/** Upload time of a round, or 0 when its date doesn't parse. */
export function roundTimestamp(video: VideoType): number {
  const ms = Date.parse(video[2] ?? "");
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Which side the follow debated on: the side whose team label holds one of
 * `phrases` as whole words. `null` when neither or both sides do (a school
 * debating itself), or the round has no teams recorded.
 */
export function followedSide(video: VideoType, phrases: readonly string[]): "aff" | "neg" | null {
  const aff = phrases.some((p) => phraseInText(video[9] ?? null, p));
  const neg = phrases.some((p) => phraseInText(video[10] ?? null, p));
  if (aff === neg) return null;
  return aff ? "aff" : "neg";
}

/** Whether `side` won the round; `null` when the decision isn't recorded. */
function sideWon(video: VideoType, side: "aff" | "neg"): boolean | null {
  const affWin = video[11];
  if (typeof affWin !== "boolean") return null;
  return side === "aff" ? affWin : !affWin;
}

/** One round from the follow's point of view. */
interface FollowedRound {
  video: VideoType;
  side: "aff" | "neg" | null;
  won: boolean | null;
  level: StandardRoundLevel;
  timestamp: number;
  ours: string | null;
  opponent: string | null;
}

function toFollowedRound(video: VideoType, phrases: readonly string[]): FollowedRound {
  const side = followedSide(video, phrases);
  return {
    video,
    side,
    won: side ? sideWon(video, side) : null,
    level: standardizeRoundLevel(video[8] ?? null),
    timestamp: roundTimestamp(video),
    ours: side ? (side === "aff" ? video[9] : video[10]) ?? null : null,
    opponent: side ? (side === "aff" ? video[10] : video[9]) ?? null : null,
  };
}

/** A follow's run at one tournament. */
export interface TournamentRun {
  tournament: string;
  wins: number;
  losses: number;
  rounds: number;
  /** Deepest elim round recorded, or `null` when every round was a prelim. */
  deepestElim: StandardRoundLevel | null;
  /** Won the final round. */
  champion: boolean;
  /** Lost the final round. */
  finalist: boolean;
  lastTimestamp: number;
}

/**
 * Groups rounds into one run per tournament (and season, so the same
 * tournament a year apart stays two runs), newest run first.
 */
export function tournamentRuns(rounds: readonly VideoType[], phrases: readonly string[]): TournamentRun[] {
  const runs = new Map<string, TournamentRun>();
  for (const video of rounds) {
    const tournament = video[7]?.trim();
    if (!tournament) continue;
    const round = toFollowedRound(video, phrases);
    const key = `${video[17] ?? 0}|${tournament.toLowerCase()}`;
    const run = runs.get(key) ?? {
      tournament,
      wins: 0,
      losses: 0,
      rounds: 0,
      deepestElim: null,
      champion: false,
      finalist: false,
      lastTimestamp: 0,
    };
    run.rounds += 1;
    if (round.won === true) run.wins += 1;
    if (round.won === false) run.losses += 1;
    run.lastTimestamp = Math.max(run.lastTimestamp, round.timestamp);
    const depth = ELIM_DEPTH[round.level] ?? 0;
    if (depth > 0 && depth > (run.deepestElim ? (ELIM_DEPTH[run.deepestElim] ?? 0) : 0)) {
      run.deepestElim = round.level;
    }
    if (round.level === "FINALS" && round.won === true) run.champion = true;
    if (round.level === "FINALS" && round.won === false) run.finalist = true;
    runs.set(key, run);
  }
  return [...runs.values()].sort((a, b) => b.lastTimestamp - a.lastTimestamp);
}

/** "5–2", or "" when no decision is recorded. */
function record(wins: number, losses: number): string {
  return wins + losses > 0 ? `${wins}–${losses}` : "";
}

/** How a run ended, e.g. "won the tournament" or "reached Quarterfinals". */
export function runOutcome(run: TournamentRun): string {
  if (run.champion) return "won the tournament";
  if (run.finalist) return "finished runner-up";
  if (run.deepestElim) return `reached ${formatRoundLevel(run.deepestElim)}`;
  return "";
}

/** "5–2, reached Semifinals" — whichever parts are known. */
function runSummary(run: TournamentRun): string {
  const parts = [record(run.wins, run.losses), runOutcome(run)].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : `${run.rounds} recorded round${run.rounds === 1 ? "" : "s"}`;
}

/**
 * Estimated rating change from `rounds`, on the scale the site shows, keyed
 * by the follow's team label (a school has several). A round counts when its
 * result is recorded and both teams are found in the rankings.
 */
export function estimateRatingChanges(
  rounds: readonly VideoType[],
  phrases: readonly string[],
  datasets: readonly RankingDataset[],
): Map<string, { delta: number; rounds: number }> {
  const changes = new Map<string, { delta: number; rounds: number }>();
  if (datasets.length === 0) return changes;
  for (const video of rounds) {
    const round = toFollowedRound(video, phrases);
    if (round.won === null || !round.ours) continue;
    const ours = findVideoTeamRanking(datasets, video[6], round.ours);
    const theirs = findVideoTeamRanking(datasets, video[6], round.opponent);
    if (!ours || !theirs) continue;
    const expected = winProbability(ours, theirs);
    const delta = (RATING_K * ((round.won ? 1 : 0) - expected)) / RATING_DIVISOR;
    const key = round.ours.trim();
    const current = changes.get(key) ?? { delta: 0, rounds: 0 };
    changes.set(key, { delta: current.delta + delta, rounds: current.rounds + 1 });
  }
  return changes;
}

/** "+1.4" / "−0.6" */
function signed(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (rounded === 0) return "±0.0";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(1)}`;
}

/** UTC start of the month `offset` months from `now`'s month (negative = earlier). */
function monthStart(now: number, offset: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1);
}

/**
 * The recap of one completed month: record, each tournament's result with
 * the deep elim runs called out, and the estimated rating change. `null`
 * when the follow has no rounds that month.
 *
 * @param start - UTC start of the month.
 */
export function monthlyRecap(input: FollowNewsInput, start: number): FollowNewsItem | null {
  const end = monthStart(start, 1);
  const rounds = input.rounds.filter((v) => {
    const t = roundTimestamp(v);
    return t >= start && t < end;
  });
  if (rounds.length === 0) return null;
  const { follow } = input;
  const phrases = competitorPhrases(input.competitors);
  const runs = tournamentRuns(rounds, phrases);
  const wins = runs.reduce((n, r) => n + r.wins, 0);
  const losses = runs.reduce((n, r) => n + r.losses, 0);
  const month = `${MONTHS[new Date(start).getUTCMonth()]} ${new Date(start).getUTCFullYear()}`;

  const lines: string[] = [];
  const overall = record(wins, losses);
  lines.push(
    `${rounds.length} recorded round${rounds.length === 1 ? "" : "s"}${overall ? `, ${overall} overall` : ""}` +
      (runs.length > 0 ? ` across ${runs.length} tournament${runs.length === 1 ? "" : "s"}.` : "."),
  );

  const highlights = runs.filter((r) => r.champion || r.finalist || r.deepestElim);
  for (const run of highlights) lines.push(`Big result: ${runOutcome(run)} at ${run.tournament}.`);
  for (const run of runs.filter((r) => !highlights.includes(r))) {
    lines.push(`${run.tournament}: ${runSummary(run)}.`);
  }

  const changes = [...estimateRatingChanges(rounds, phrases, input.datasets).entries()];
  if (changes.length === 1) {
    const [, change] = changes[0];
    lines.push(`Estimated rating change: ${signed(change.delta)} over ${change.rounds} rated round${change.rounds === 1 ? "" : "s"}.`);
  } else if (changes.length > 1) {
    const sorted = changes.sort((a, b) => b[1].delta - a[1].delta);
    lines.push(
      `Estimated rating change by team: ${sorted.map(([team, c]) => `${team} ${signed(c.delta)}`).join(", ")}.`,
    );
  }

  return {
    id: `follow-recap-${follow.kind}-${follow.slug}-${new Date(start).toISOString().slice(0, 7)}`,
    category: "following",
    title: `${month} recap: ${follow.name}`,
    body: lines.join("\n"),
    // Posted the moment the month ends.
    timestamp: end,
    href: followHref(follow),
  };
}

/** "Harker LL vs Strake FS" */
function matchup(video: VideoType): string {
  const aff = video[9]?.trim();
  const neg = video[10]?.trim();
  return aff && neg ? `${aff} vs ${neg}` : video[1];
}

/**
 * Every news item for one follow: its {@link ROUNDS_PER_FOLLOW} latest rounds,
 * {@link DOCS_PER_FOLLOW} latest research documents, a result per tournament
 * within {@link RESULT_WINDOW_MS}, and a recap for each of the last
 * {@link RECAP_MONTHS} completed months it debated in.
 */
export function buildFollowNews(input: FollowNewsInput): FollowNewsItem[] {
  const { follow, now } = input;
  const phrases = competitorPhrases(input.competitors);
  const key = `${follow.kind}-${follow.slug}`;
  const items: FollowNewsItem[] = [];

  const latest = [...input.rounds].sort((a, b) => roundTimestamp(b) - roundTimestamp(a));
  for (const video of latest.slice(0, ROUNDS_PER_FOLLOW)) {
    const round = toFollowedRound(video, phrases);
    const where = [video[7], round.level === "UNKNOWN" ? null : formatRoundLevel(round.level)]
      .filter(Boolean)
      .join(" · ");
    const result =
      round.won === null || !round.ours
        ? ""
        : `${round.ours} ${round.won ? "won" : "lost"} on the ${round.side}.`;
    items.push({
      id: `follow-round-${video[0]}`,
      category: "following",
      title: `New round from ${follow.name}: ${matchup(video)}`,
      body: [where, result].filter(Boolean).join("\n") || video[1],
      timestamp: round.timestamp,
      href: videoRouteHref(video),
    });
  }

  const docs = [...input.docs].sort((a, b) => b.ingestedAt - a.ingestedAt);
  for (const doc of docs.slice(0, DOCS_PER_FOLLOW)) {
    const author = [doc.school, doc.team].filter(Boolean).join(" ");
    items.push({
      id: `follow-research-${doc.id}`,
      category: "following",
      title: `New research from ${author || follow.name}: ${doc.fileName}`,
      body: [doc.caselistLabel, `${doc.cardCount} card${doc.cardCount === 1 ? "" : "s"}`, doc.side]
        .filter(Boolean)
        .join(" · "),
      timestamp: doc.ingestedAt * 1000,
      href: followHref(follow),
    });
  }

  for (const run of tournamentRuns(input.rounds, phrases)) {
    if (run.lastTimestamp === 0 || now - run.lastTimestamp > RESULT_WINDOW_MS) continue;
    items.push({
      id: `follow-result-${key}-${run.tournament.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date(run.lastTimestamp).getUTCFullYear()}`,
      category: "following",
      title: `${follow.name} at ${run.tournament}: ${runSummary(run)}`,
      body:
        run.champion || run.finalist || run.deepestElim
          ? `A deep run: ${follow.name} ${runOutcome(run)} at ${run.tournament}.`
          : `${follow.name} debated ${run.rounds} recorded round${run.rounds === 1 ? "" : "s"} at ${run.tournament}.`,
      // Just after its last round, so the result sorts above the round itself.
      timestamp: run.lastTimestamp + 1,
      href: followHref(follow),
    });
  }

  for (let offset = 1; offset <= RECAP_MONTHS; offset++) {
    const recap = monthlyRecap(input, monthStart(now, -offset));
    if (recap) items.push(recap);
  }

  return items;
}
