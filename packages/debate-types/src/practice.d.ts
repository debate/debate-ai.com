/**
 * Wire and storage types for the Practice vs AI backend. Field names match
 * the JSON tags of the original Go `arguehub` server so existing clients keep
 * working.
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
  /** Unix seconds. */
  createdAt: number;
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
