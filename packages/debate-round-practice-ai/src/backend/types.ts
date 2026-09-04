/**
 * @fileoverview Wire and storage types for the Practice vs AI backend — the
 * Node/TypeScript port of the Go `arguehub` vs-bot models
 * (`backend/models/debatevsbot.go`) and the gin request/response structs in
 * `backend/controllers/debatevsbot_controller.go`.
 *
 * Field names are kept identical to the Go JSON tags so the ported React UI
 * (and any existing client of the Go server) talks to this backend unchanged.
 *
 * @module backend/types
 */

/**
 * Who produced a line of the transcript. Ported from `models.Message.Sender`,
 * which was a plain Go `string`: the three values below are what the UI
 * writes, but `judgeDebate` resolves the opponent's persona from the first
 * non-"User" sender, so a transcript may name the bot directly. The union
 * keeps those three as suggestions without rejecting a persona name.
 */
export type DebateSender = "User" | "Bot" | "Judge" | (string & {})

/** A single line of the debate transcript. Ported from Go `models.Message`. */
export interface DebateMessage {
  sender: DebateSender
  text: string
  /** Phase label, e.g. "Opening Statements". Optional, as in Go. */
  phase?: string
}

/**
 * Per-phase clock as stored server-side. Ported from Go `models.PhaseTiming`,
 * which splits one client-supplied duration into a user and a bot budget.
 */
export interface StoredPhaseTiming {
  name: string
  userTime: number
  botTime: number
}

/** Per-phase clock as the client sends it — one duration for both sides. */
export interface PhaseTiming {
  name: string
  /** Seconds. */
  time: number
}

/** A persisted vs-bot debate. Ported from Go `models.DebateVsBot`. */
export interface DebateVsBotRecord {
  id: string
  /** Owner. The Go server keyed debates by the token's email. */
  email: string
  botName: string
  botLevel: string
  topic: string
  /** The bot's stance — "for" or "against". */
  stance: string
  history: DebateMessage[]
  phaseTimings: StoredPhaseTiming[]
  /** Free-text outcome, e.g. "User conceded" or the raw judge JSON. */
  outcome?: string
  /** Unix seconds. */
  createdAt: number
}

/** POST /vsbot/create and POST /vsbot/debate body. Ported from `DebateRequest`. */
export interface DebateRequestBody {
  botName: string
  botLevel: string
  topic: string
  stance: string
  history?: DebateMessage[]
  phaseTimings?: PhaseTiming[]
  /** Turn-level nudge ("Ask a clear and concise question…"). */
  context?: string
}

/** POST /vsbot/create response. Ported from `DebateResponse`. */
export interface CreateDebateResponse {
  debateId: string
  botName: string
  botLevel: string
  topic: string
  stance: string
  phaseTimings?: StoredPhaseTiming[]
}

/** POST /vsbot/debate response. Ported from `DebateMessageResponse`. */
export interface DebateMessageResponse {
  debateId: string
  botName: string
  botLevel: string
  topic: string
  stance: string
  response: string
}

/** POST /vsbot/judge body. Ported from `JudgeRequest`. */
export interface JudgeRequestBody {
  history: DebateMessage[]
}

/** POST /vsbot/judge response. Ported from `JudgeResponse`. */
export interface JudgeResponse {
  result: string
}

/** POST /vsbot/concede body. Ported from `ConcedeRequest`. */
export interface ConcedeRequestBody {
  debateId: string
  history?: DebateMessage[]
}

/** How a finished debate resolved, as the Go controller classified it. */
export type DebateResultStatus = "win" | "loss" | "draw" | "pending"

/** One side's score for one judged phase. */
export interface JudgedScore {
  score: number
  reason: string
}

/** The judge's strict-JSON verdict, as prompted for in `services.JudgeDebate`. */
export interface JudgmentData {
  opening_statement: { user: JudgedScore; bot: JudgedScore }
  cross_examination: { user: JudgedScore; bot: JudgedScore }
  answers: { user: JudgedScore; bot: JudgedScore }
  closing: { user: JudgedScore; bot: JudgedScore }
  total: { user: number; bot: number }
  verdict: {
    winner: string
    reason: string
    congratulations: string
    opponent_analysis: string
  }
}

/** The identity a handler acts on behalf of, resolved by the host app. */
export interface DebateActor {
  /** Stable user id. Corresponds to the Go controller's Mongo `_id`. */
  userId: string
  /** The user's email, which the Go schema used as the debate's owner key. */
  email: string
}

/** A handler's result, framework-agnostic so any host can adapt it. */
export interface HandlerResult<T> {
  status: number
  body: T | { error: string }
}
