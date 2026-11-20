/**
 * @fileoverview Rebuttal Playlists — the wire format of `/api/rebuttal-drills`
 * and the shapes the playlists page reads.
 *
 * ## What a rebuttal drill is
 *
 * A student watches one round from a curated playlist (`./playlists.ts`) —
 * a final, a famous elim, a round that went to a kritik — and redoes one
 * side's last rebuttal as if they were in it. Each drill pairs two debaters on
 * the same video: one redoes the Aff rebuttal, the other the Neg rebuttal.
 * The partner is another student who picked the same video and the other side
 * (matched by the server), or the AI when nobody is around. Either debater may
 * ask the AI coach for help on their draft a few times before turning it in.
 * Once both rebuttals are in, the AI judge decides who rebutted better and
 * gives each side feedback.
 *
 * Progress is the share of a playlist's videos the student has redone a
 * rebuttal for, per side (`./progress.ts`).
 *
 * @module debate-practice-rounds/rebuttal-playlists/types
 */

import type { ChallengeFormat, ChallengePerson, ChallengeSide } from "../debate-challenges/types";

export type { ChallengeFormat as DrillFormat, ChallengePerson as DrillPerson, ChallengeSide as DrillSide };

/** The id the AI partner goes by on the wire. Never a real account id. */
export const AI_PARTNER_ID = "ai";

/** How long a drill waits for a human partner before it stops being offered to others. */
export const PARTNER_WAIT_DAYS = 7;
export const PARTNER_WAIT_SECONDS = PARTNER_WAIT_DAYS * 24 * 60 * 60;

/** Shortest rebuttal accepted, in characters. */
export const MIN_REBUTTAL_LENGTH = 80;
/** Longest rebuttal accepted, in characters (about 1,200 words). */
export const MAX_REBUTTAL_LENGTH = 7000;
/** How many times each side may ask the AI coach for help on one drill. */
export const MAX_COACH_USES = 3;
/** Most drills against the AI one student may start in a day; each costs a few model calls. */
export const MAX_AI_DRILLS_PER_DAY = 15;
/** Most drills one student may have open (waiting or writing) at once. */
export const MAX_OPEN_DRILLS = 12;

/** A playlist's format, level and style tags, for the filters and the card. */
export type PlaylistLevel = "novice" | "varsity" | "college";

/** One round in a playlist. Ids are YouTube ids of rows in the `videos` table. */
export interface PlaylistVideo {
  videoId: string;
  title: string;
  format: ChallengeFormat;
  tournament: string;
  /** "Finals", "Semis", "Round 5"… as listed. */
  round: string;
  /** Season year the round was published in (0 for pre-2010 legacy rounds). */
  season: number;
  affTeam: string;
  negTeam: string;
  /** The 2NR's main argument when the library records one ("K", "T-Subsets"…). */
  lastRebuttal?: string;
}

/** A curated playlist of ten rounds. */
export interface RebuttalPlaylist {
  id: string;
  title: string;
  description: string;
  /** Format filter label: "Policy", "Public Forum", "Lincoln-Douglas", "College Policy", "Mixed". */
  formatLabel: string;
  level: PlaylistLevel;
  /** Style tag: "Finals", "Elims", "Kritik", "Theory", "Traditional", "Prelims". */
  style: string;
  /** Emoji on the card. */
  emoji: string;
  videos: readonly PlaylistVideo[];
}

/**
 * Where a drill is in its life.
 *
 * - `waiting` — one debater is in; waiting for a partner on the other side.
 * - `writing` — both sides are filled; waiting on one or both rebuttals.
 * - `judging` — both rebuttals are in; waiting on the AI judge.
 * - `complete` — judged.
 * - `cancelled` — the starter withdrew while waiting.
 */
export type RebuttalDrillStatus = "waiting" | "writing" | "judging" | "complete" | "cancelled";

/** One side of a drill as the page shows it. */
export interface RebuttalDrillSeat {
  side: ChallengeSide;
  /** `null` while nobody has taken this side. */
  person: ChallengePerson | null;
  /** Whether this side's rebuttal is in. */
  submitted: boolean;
  /**
   * The rebuttal text: always the viewer's own; the partner's only once the
   * drill is judged (so neither side can copy the other's answers).
   */
  text: string | null;
  /** How many coach requests this side has left. */
  coachLeft: number;
}

/** A drill as one of its debaters sees it. */
export interface RebuttalDrill {
  id: string;
  playlistId: string;
  videoId: string;
  format: ChallengeFormat;
  /** The video's title, which stands in for the resolution. */
  topic: string;
  status: RebuttalDrillStatus;
  vsAi: boolean;
  viewerSide: ChallengeSide;
  aff: RebuttalDrillSeat;
  neg: RebuttalDrillSeat;
  winnerSide: ChallengeSide | null;
  /** The judge's reason for decision with feedback for each side, once judged. */
  decision: string;
  /** What the viewer may do right now. */
  moves: RebuttalDrillAction[];
  /** Unix seconds. */
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

/** Debaters waiting for a partner on one video, for the "join" hints. */
export interface OpenSeatCount {
  videoId: string;
  /** The side a joiner would take. */
  side: ChallengeSide;
  count: number;
}

/** What `GET /api/rebuttal-drills` returns. */
export interface RebuttalBoardResponse {
  viewer: ChallengePerson;
  drills: RebuttalDrill[];
  /** Other debaters' drills waiting for a partner, by video and the open side. */
  openSeats: OpenSeatCount[];
}

/** The body of `POST /api/rebuttal-drills`: start a drill or join a waiting one. */
export interface NewRebuttalDrill {
  playlistId: string;
  videoId: string;
  /** The side the viewer redoes. */
  side: ChallengeSide;
  /** `partner` pairs with a student (or waits for one); `ai` pairs with the AI at once. */
  partner: "partner" | "ai";
}

/** Everything a debater can do to a drill. */
export type RebuttalDrillAction = "submit" | "coach" | "cancel" | "use_ai";

/** The body of `PATCH /api/rebuttal-drills/[id]`. */
export interface RebuttalDrillUpdate {
  action: RebuttalDrillAction;
  /** The rebuttal, for `submit`; the draft to get help on, for `coach`. */
  text?: string;
}

/** What `PATCH … { action: "coach" }` returns alongside the drill. */
export interface CoachHelp {
  feedback: string;
}
