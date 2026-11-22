/**
 * @fileoverview Wire and storage types for the Practice vs AI backend. Field names
 * match the JSON tags of the original Go `arguehub` server so existing
 * clients keep working.
 *
 * @module backend/types
 */

/** What a finished round earns. Fed to the store as one atomic update. */
export interface GamificationAward {
  /** Points to add to the user's score. */
  points: number;
  /** The score-update action label the Go code wrote to `score_updates`. */
  action: string;
  /** Badges to grant that the user does not already hold. */
  badgesAwarded: string[];
  /** The score the user ends the round on. */
  newScore: number;
}

/**
 * Who produced a line of the transcript. The three named values are what the
 * UI writes, but a transcript may also name the opponent's persona directly.
 */
export type DebateSender = "User" | "Bot" | "Judge" | (string & {});

/** A single line of the debate transcript. */
export interface DebateMessage {
  /** Who said it. */
  sender: DebateSender;
  /** What was said. */
  text: string;
  /** Phase label, e.g. "Opening Statements". Optional, as in Go. */
  phase?: string;
}

/** Per-phase clock as stored server-side, split into a user and a bot budget. */
export interface StoredPhaseTiming {
  /** Phase name. */
  name: string;
  /** Seconds the user has in the phase. */
  userTime: number;
  /** Seconds the bot has in the phase. */
  botTime: number;
}

/** Per-phase clock as the client sends it — one duration for both sides. */
export interface PhaseTiming {
  /** Phase name. */
  name: string;
  /** Seconds. */
  time: number;
}

/** A persisted vs-bot debate. */
export interface DebateVsBotRecord {
  /** Debate id. */
  id: string;
  /** Owner. The Go server keyed debates by the token's email. */
  email: string;
  /** The opponent's name. */
  botName: string;
  /** The opponent's difficulty level. */
  botLevel: string;
  /** The resolution being debated. */
  topic: string;
  /** The bot's stance — "for" or "against". */
  stance: string;
  /** The transcript so far. */
  history: DebateMessage[];
  /** The clock for each phase. */
  phaseTimings: StoredPhaseTiming[];
  /** Free-text outcome, e.g. "User conceded" or the raw judge JSON. */
  outcome?: string;
  /**
   * The Coach debrief last saved for this round from the scorecard. Missing
   * on rounds that never asked for one, and on rounds from before it was
   * saved.
   */
  debrief?: RoundDebriefRecord;
  /**
   * The Judge feedback style the verdict in `outcome` was written in — a
   * `@debate-ai/speech-writer` `CoachPersonaId` ("standard", "socratic", …),
   * already resolved, so an unknown or missing request style is stored as
   * "standard". Set by `POST /vsbot/judge`; cleared when the outcome is
   * replaced without one (a concede). Missing on rounds judged before it was
   * stored.
   */
  judgeFeedbackStyle?: string;
  /**
   * The arguments each side chose on the setup wizard, kept with the round
   * so Debate History can show what was run. Built by `savedRoundPlan`:
   * clipped like the per-turn plan, without the evidence `cards`. Missing on
   * rounds started without a plan (the quick bot picker, older clients) and
   * on rounds from before it was stored.
   */
  plan?: RoundPlan;
  /** Unix seconds. */
  createdAt: number;
}

/** Extra facts recorded alongside a round's outcome. */
export interface OutcomeDetails {
  /** The resolved Judge feedback style the verdict was written in. */
  feedbackStyle?: string;
}

/** A Coach debrief kept with its round, so Debate History can show it again. */
export interface RoundDebriefRecord {
  /**
   * The coaching style it was written in — a `@debate-ai/speech-writer`
   * `CoachPersonaId` ("standard", "socratic", …). Stored as given; an id the
   * UI doesn't know shows as Standard.
   */
  personaId: string;
  /** The debrief text, as the coach wrote it. */
  text: string;
  /** Unix seconds when it was saved. */
  savedAt: number;
  /**
   * Unix milliseconds when the debrief reached the scorecard, by the
   * player's clock. Orders two saves for the same round: a save whose
   * `writtenAt` is older than the stored one's is not applied (see
   * `shouldReplaceDebrief`). Missing on debriefs saved before it was sent.
   */
  writtenAt?: number;
}

/** POST /vsbot/debrief body. */
export interface SaveDebriefRequestBody {
  /** The round the debrief is about. */
  debateId: string;
  /** The coaching style it was written in. */
  personaId: string;
  /** The debrief text. */
  text: string;
  /**
   * Unix milliseconds when the debrief reached the scorecard. Optional for
   * older clients; without it the save always replaces the stored debrief.
   */
  writtenAt?: number;
}

/** POST /vsbot/debrief response. */
export interface SaveDebriefResponse {
  /**
   * False when the store keeps nothing (a signed-out player's round), so the
   * scorecard can say it wasn't kept.
   */
  saved: boolean;
  /**
   * True when this debrief was not stored because the round already keeps
   * one written later (another tab or device saved it, or this save arrived
   * after a newer one). `saved` is false.
   */
  superseded?: boolean;
  /** The stored debrief, when `saved`. */
  debrief?: RoundDebriefRecord;
}

/** POST /vsbot/create and POST /vsbot/debate body. */
export interface DebateRequestBody {
  /** The opponent's name. */
  botName: string;
  /** The opponent's difficulty level. */
  botLevel: string;
  /** The resolution being debated. */
  topic: string;
  /** The bot's stance — "for" or "against". */
  stance: string;
  /** The transcript so far. */
  history?: DebateMessage[];
  /** The clock for each phase. */
  phaseTimings?: PhaseTiming[];
  /** Turn-level nudge ("Ask a clear and concise question…"). */
  context?: string;
  /**
   * What each side chose to run, picked on the setup wizard's last step.
   * Steers the bot toward real-round strategy; omitted on older clients.
   */
  plan?: RoundPlan;
}

/** "with": cite the evidence cards found in prep. "without": analytics only. */
export type EvidenceMode = "with" | "without";

/** One argument a side runs in the round: an advantage, disad, CP, K, T or case answer. */
export interface RoundArgument {
  /** Short name as a debater would signpost it, e.g. "Spending DA". */
  title: string;
  /** The link chain or claim-warrant-impact, in a sentence or two. */
  summary?: string;
  /** "advantage", "disad", "counterplan", "kritik", "topicality", "case". */
  kind?: string;
}

/** One evidence card the bot may cite in "with" evidence mode. */
export interface RoundEvidenceCard {
  /** The card's tag line. */
  tag: string;
  /** Author, year and source. */
  cite?: string;
  /** A short excerpt of the card's text. */
  excerpt?: string;
}

/** The arguments and evidence both sides take into a vs-bot round. */
export interface RoundPlan {
  /** Whether the round uses evidence cards. */
  evidence: EvidenceMode;
  /** The affirmative's plan text, when the topic has a default one (e.g. single payer). */
  affPlan?: string;
  /** The arguments the debater chose to run. */
  userArguments: RoundArgument[];
  /** The arguments the bot runs. */
  botArguments: RoundArgument[];
  /** Cards the bot may cite; empty in "without" mode. */
  cards?: RoundEvidenceCard[];
}

/** POST /vsbot/create response. */
export interface CreateDebateResponse {
  /** The new debate's id. */
  debateId: string;
  /** The opponent's name. */
  botName: string;
  /** The opponent's difficulty level. */
  botLevel: string;
  /** The resolution being debated. */
  topic: string;
  /** The bot's stance. */
  stance: string;
  /** The clock for each phase. */
  phaseTimings?: StoredPhaseTiming[];
}

/** POST /vsbot/debate response. */
export interface DebateMessageResponse {
  /** The debate's id. */
  debateId: string;
  /** The opponent's name. */
  botName: string;
  /** The opponent's difficulty level. */
  botLevel: string;
  /** The resolution being debated. */
  topic: string;
  /** The bot's stance. */
  stance: string;
  /** The bot's reply. */
  response: string;
}

/** POST /vsbot/judge body. */
export interface JudgeRequestBody {
  /** The transcript to judge. */
  history: DebateMessage[];
  /**
   * Optional coaching style for the scorecard's wording — a
   * `@debate-ai/speech-writer` `CoachPersonaId` ("socratic",
   * "devils-advocate", "fact-checker"). Missing, "standard" or anything
   * unrecognised judges in the default voice. Never affects the scores.
   */
  feedbackStyle?: string;
}

/** POST /vsbot/judge response. */
export interface JudgeResponse {
  /** The judge's verdict as JSON text. */
  result: string;
  /** Set only when the store implements the gamification hooks. */
  gamification?: GamificationAward;
}

/** POST /vsbot/concede body. */
export interface ConcedeRequestBody {
  /** The debate being conceded. */
  debateId: string;
  /** The transcript so far. */
  history?: DebateMessage[];
}

/** POST /vsbot/concede response. */
export interface ConcedeResponse {
  /** Confirmation text. */
  message: string;
  /** Set only when the store implements the gamification hooks. */
  gamification?: GamificationAward;
}

/** How a finished debate resolved, as the Go controller classified it. */
export type DebateResultStatus = "win" | "loss" | "draw" | "pending";

/** One side's score for one judged phase. */
export interface JudgedScore {
  /** The score awarded. */
  score: number;
  /** Why. */
  reason: string;
}

/** The judge's strict-JSON verdict. */
export interface JudgmentData {
  /** Scores for the opening statements. */
  opening_statement: { user: JudgedScore; bot: JudgedScore };
  /** Scores for cross-examination. */
  cross_examination: { user: JudgedScore; bot: JudgedScore };
  /** Scores for the answers. */
  answers: { user: JudgedScore; bot: JudgedScore };
  /** Scores for the closing statements. */
  closing: { user: JudgedScore; bot: JudgedScore };
  /** Total score for each side. */
  total: { user: number; bot: number };
  /** The decision. */
  verdict: {
    /** Who won. */
    winner: string;
    /** The reason for decision. */
    reason: string;
    /** A note congratulating the user. */
    congratulations: string;
    /** Feedback on how the opponent argued. */
    opponent_analysis: string;
  };
}

/** The identity a handler acts on behalf of, resolved by the host app. */
export interface DebateActor {
  /** Stable user id. Corresponds to the Go controller's Mongo `_id`. */
  userId: string;
  /** The user's email, which the Go schema used as the debate's owner key. */
  email: string;
}

/** A handler's result, framework-agnostic so any host can adapt it. */
export interface HandlerResult<T> {
  /** HTTP status code. */
  status: number;
  /** The response body, or an error message. */
  body: T | { error: string };
}
