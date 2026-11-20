/**
 * @fileoverview Playlist progress and the rebuttal-drill rank — pure counts
 * over the viewer's drills.
 *
 * A video counts as done on a side once the viewer has turned in a rebuttal
 * for that side of it, in any drill that wasn't cancelled; it doesn't have to
 * be judged, or won. A playlist is "complete" once every video is done on at
 * least one side, and "mastered" once every video is done on both.
 *
 * @module debate-practice-rounds/rebuttal-playlists/progress
 */

import type { DrillSide, RebuttalDrill, RebuttalPlaylist } from "./types";

/** One playlist's progress for the viewer. */
export interface PlaylistProgress {
  playlistId: string;
  total: number;
  /** Videos done on at least one side. */
  done: number;
  /** Videos done on both sides. */
  bothSides: number;
  affDone: number;
  negDone: number;
  /** Judged drills the viewer won on this playlist. */
  wins: number;
  /** `done / total`, 0–100, rounded down. */
  percent: number;
  /** Video ids done, by side. */
  doneBySide: Record<DrillSide, ReadonlySet<string>>;
}

/** Which videos the viewer has redone, per side, from their drills. */
export function doneVideos(drills: readonly RebuttalDrill[], playlistId?: string): Record<DrillSide, Set<string>> {
  const out: Record<DrillSide, Set<string>> = { aff: new Set(), neg: new Set() };
  for (const drill of drills) {
    if (drill.status === "cancelled") continue;
    if (playlistId && drill.playlistId !== playlistId) continue;
    const seat = drill.viewerSide === "aff" ? drill.aff : drill.neg;
    if (seat.submitted) out[drill.viewerSide].add(drill.videoId);
  }
  return out;
}

/** Progress on one playlist. */
export function playlistProgress(playlist: RebuttalPlaylist, drills: readonly RebuttalDrill[]): PlaylistProgress {
  const ids = new Set(playlist.videos.map((video) => video.videoId));
  const mine = drills.filter((drill) => drill.playlistId === playlist.id && ids.has(drill.videoId));
  const done = doneVideos(mine);
  let any = 0;
  let both = 0;
  for (const id of ids) {
    const aff = done.aff.has(id);
    const neg = done.neg.has(id);
    if (aff || neg) any += 1;
    if (aff && neg) both += 1;
  }
  const wins = mine.filter((drill) => drill.status === "complete" && drill.winnerSide === drill.viewerSide).length;
  const total = ids.size;
  return {
    playlistId: playlist.id,
    total,
    done: any,
    bothSides: both,
    affDone: done.aff.size,
    negDone: done.neg.size,
    wins,
    percent: total === 0 ? 0 : Math.floor((any / total) * 100),
    doneBySide: done,
  };
}

/** Progress on every playlist, in list order. */
export function allPlaylistProgress(
  playlists: readonly RebuttalPlaylist[],
  drills: readonly RebuttalDrill[],
): PlaylistProgress[] {
  return playlists.map((playlist) => playlistProgress(playlist, drills));
}

/** A rank on the rebuttal ladder. */
export interface RebuttalRank {
  title: string;
  /** Rebuttals turned in to reach this rank. */
  min: number;
}

/** The ladder, lowest first. 100 is every video of every playlist on one side; 200 is both. */
export const REBUTTAL_RANKS: readonly RebuttalRank[] = [
  { title: "Novice", min: 0 },
  { title: "JV", min: 5 },
  { title: "Varsity", min: 15 },
  { title: "Bid Debater", min: 35 },
  { title: "Elim Regular", min: 60 },
  { title: "Finalist", min: 100 },
  { title: "Champion", min: 150 },
  { title: "GOAT", min: 200 },
];

/** Where `rebuttals` turned in puts the viewer, and how far to the next rank. */
export function rebuttalRank(rebuttals: number): {
  rank: RebuttalRank;
  next: RebuttalRank | null;
  /** 0–100 toward the next rank (100 at the top). */
  toNext: number;
} {
  let index = 0;
  for (let i = 0; i < REBUTTAL_RANKS.length; i++) if (rebuttals >= REBUTTAL_RANKS[i].min) index = i;
  const rank = REBUTTAL_RANKS[index];
  const next = REBUTTAL_RANKS[index + 1] ?? null;
  const toNext = next ? Math.floor(((rebuttals - rank.min) / (next.min - rank.min)) * 100) : 100;
  return { rank, next, toNext };
}

/** Total rebuttals the viewer has turned in across every playlist (one per video and side). */
export function totalRebuttals(progress: readonly PlaylistProgress[]): number {
  return progress.reduce((sum, entry) => sum + entry.affDone + entry.negDone, 0);
}
