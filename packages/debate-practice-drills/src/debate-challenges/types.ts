/**
 * @fileoverview The Online Challenges wire format — what `/api/debate-challenges`
 * sends and what the challenges board reads.
 *
 * ## What a challenge is
 *
 * An asynchronous, written debate between two players, or a player and the AI,
 * on one resolution. The challenger picks the format, the resolution (any topic
 * in `debate-topics.json`, or one of their own) and a side; the opponent gets
 * {@link RESPONSE_WINDOW_DAYS} days to answer each speech. The round is
 * {@link SPEECH_ORDER}: two constructives and two rebuttals, Aff first. After
 * the last speech an AI judge picks the winner and writes a short decision.
 *
 * Letting a response window run out forfeits the round to the other side —
 * except before the opponent's first answer, where it just expires (nobody
 * agreed to debate yet, so nobody loses).
 *
 * Wins pay XP (`./rewards.ts`), multiplied by a win-streak boost, and unlock
 * trophies.
 *
 * @module debate-practice-rounds/debate-challenges/types
 */

/** Formats a challenge can be debated in. Ids are stored; labels are shown. */
export const CHALLENGE_FORMATS = [
  { id: "pf", label: "Public Forum" },
  { id: "ld", label: "Lincoln-Douglas" },
  { id: "policy", label: "Policy" },
  { id: "ndt", label: "College Policy (NDT)" },
  { id: "parli", label: "Parliamentary" },
  { id: "worlds", label: "Worlds / BP" },
] as const;

export type ChallengeFormat = (typeof CHALLENGE_FORMATS)[number]["id"];

export type ChallengeSide = "aff" | "neg";

/** AI opponent strength, weakest first. Shapes the AI's speech prompt. */
export const AI_LEVELS = [
  { id: "novice", label: "Novice" },
  { id: "varsity", label: "Varsity" },
  { id: "champion", label: "Champion" },
] as const;

export type AiLevel = (typeof AI_LEVELS)[number]["id"];

/** The four speeches of a challenge, in the order they are given. */
export const SPEECH_ORDER: readonly { side: ChallengeSide; label: string }[] = [
  { side: "aff", label: "Affirmative constructive" },
  { side: "neg", label: "Negative constructive" },
  { side: "aff", label: "Affirmative rebuttal" },
  { side: "neg", label: "Negative rebuttal" },
];

/** How long each side has to answer the other's speech. */
export const RESPONSE_WINDOW_DAYS = 3;
export const RESPONSE_WINDOW_SECONDS = RESPONSE_WINDOW_DAYS * 24 * 60 * 60;

/** Shortest speech accepted, in characters — a sentence or two of argument. */
export const MIN_SPEECH_LENGTH = 40;
/** Longest speech accepted, in characters (about 1,500 words). */
export const MAX_SPEECH_LENGTH = 9000;
/** Longest resolution accepted, in characters. */
export const MAX_CHALLENGE_TOPIC_LENGTH = 400;
/** Longest note to the opponent, in characters. */
export const MAX_CHALLENGE_NOTE_LENGTH = 300;
/**
 * Most challenges one player may have waiting on someone else's first answer.
 * Each one lands as a notification, so this keeps challenging from becoming
 * spamming.
 */
export const MAX_PENDING_SENT = 10;

/**
 * Where a challenge is in its life.
 *
 * - `pending` — sent; waiting on the opponent's first speech (or a decline).
 * - `active` — both sides have spoken; speeches alternate.
 * - `judging` — all four speeches are in; waiting on the AI judge.
 * - `complete` — decided, by the judge, a concession or a forfeit.
 * - `declined` / `cancelled` / `expired` — closed with no result.
 */
export type DebateChallengeStatus =
  | "pending"
  | "active"
  | "judging"
  | "complete"
  | "declined"
  | "cancelled"
  | "expired";

/** How a complete challenge was decided. */
export type DecisionMethod = "judge" | "forfeit" | "concession";

/** One speech as stored. `authorId` is `null` for the AI's speeches. */
export interface ChallengeSpeech {
  side: ChallengeSide;
  authorId: string | null;
  text: string;
  /** Unix seconds. */
  submittedAt: number;
}

/** Public fields of an account — never an email. */
export interface ChallengePerson {
  id: string;
  name: string;
  imageUrl: string | null;
}

/** The id the AI opponent goes by on the wire. Never a real account id. */
export const AI_OPPONENT_ID = "ai";

/** The AI opponent as a person, for the board. */
export function aiPerson(level: AiLevel): ChallengePerson {
  const label = AI_LEVELS.find((entry) => entry.id === level)?.label ?? "Varsity";
  return { id: AI_OPPONENT_ID, name: `AI opponent (${label})`, imageUrl: null };
}

/** What the viewer earns from one finished challenge. */
export interface ChallengeReward {
  /** Total XP, base plus win plus boost. */
  xp: number;
  won: boolean;
  /** The win-streak multiplier applied to the win XP (1 when there was none). */
  boost: number;
  /** Whether the viewer has already collected it. */
  claimed: boolean;
}

/** A challenge as the board shows it to one of its two debaters. */
export interface DebateChallenge {
  id: string;
  status: DebateChallengeStatus;
  format: ChallengeFormat;
  topic: string;
  note: string;
  challenger: ChallengePerson;
  opponent: ChallengePerson;
  /** Whether the opponent is the AI. */
  vsAi: boolean;
  aiLevel: AiLevel | null;
  challengerSide: ChallengeSide;
  /** The viewer's side. */
  viewerSide: ChallengeSide;
  speeches: ChallengeSpeech[];
  /** Whose speech is next, by account id ({@link AI_OPPONENT_ID} for the AI), or `null` when none is. */
  turnId: string | null;
  /** Unix seconds the current response window closes, or `null` when no one is on the clock. */
  deadlineAt: number | null;
  winnerSide: ChallengeSide | null;
  decisionMethod: DecisionMethod | null;
  /** The judge's reason for decision, when it was judged. */
  decision: string;
  /** The viewer's reward, once complete. */
  reward: ChallengeReward | null;
  /** What the viewer may do right now (from `rules.ts`), plus `claim` for an uncollected reward. */
  moves: DebateChallengeAction[];
  /** Unix seconds. */
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

/** One trophy and whether the viewer has it. */
export interface TrophyStatus {
  id: string;
  title: string;
  description: string;
  emoji: string;
  earned: boolean;
}

/** The viewer's record across every finished challenge. */
export interface ChallengeStats {
  played: number;
  wins: number;
  losses: number;
  /** Wins in a row up to the latest result. */
  currentStreak: number;
  bestStreak: number;
  /** The multiplier the viewer's next win gets. */
  nextBoost: number;
  /** XP earned from challenges so far (claimed or not). */
  totalXp: number;
}

/** What `GET /api/debate-challenges` returns. */
export interface ChallengeBoardResponse {
  viewer: ChallengePerson;
  challenges: DebateChallenge[];
  stats: ChallengeStats;
  trophies: TrophyStatus[];
}

/** The body of `POST /api/debate-challenges`. */
export interface NewDebateChallenge {
  /** An account id, or {@link AI_OPPONENT_ID} to debate the AI. */
  opponentId: string;
  /** Only read when debating the AI; defaults to `varsity`. */
  aiLevel?: AiLevel;
  format: ChallengeFormat;
  topic: string;
  /** The challenger's side. */
  side: ChallengeSide;
  /** Required when the challenger is Aff: the opening speech goes out with the challenge. */
  speech?: string;
  note?: string;
}

/** Everything a debater can do to a challenge. */
export type DebateChallengeAction = "speak" | "decline" | "cancel" | "concede" | "claim";

/** The body of `PATCH /api/debate-challenges/[id]`. */
export interface DebateChallengeUpdate {
  action: DebateChallengeAction;
  /** The speech, for `speak`. */
  text?: string;
}

/** Label for an id from one of the option lists, falling back to the id itself. */
export function challengeOptionLabel(options: readonly { id: string; label: string }[], id: string): string {
  return options.find((option) => option.id === id)?.label ?? id;
}

export function otherSide(side: ChallengeSide): ChallengeSide {
  return side === "aff" ? "neg" : "aff";
}
