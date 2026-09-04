/**
 * @fileoverview Persistence seam — the port of what Go
 * `backend/db`/`backend/services/CreateDebateService` did against MongoDB
 * (`DebateVsBotCollection`, `SaveDebateVsBot`, `UpdateDebateVsBotOutcome`,
 * `GetLatestDebateVsBot`) plus the transcript and gamification writes the
 * controller made.
 *
 * The Go server hard-wired Mongo. This package instead defines the interface
 * and ships an in-memory implementation; debate-ai.com supplies a
 * Drizzle/D1-backed one, so the same handlers run against either.
 *
 * @module backend/store
 */

import type { GamificationAward, GamificationProfile } from "./gamification"
import type { DebateMessage, DebateResultStatus, DebateVsBotRecord } from "./types"

/** A finished round, handed to the store so it can record history. */
export interface DebateTranscriptInput {
  userId: string
  email: string
  /** Always "user_vs_bot" here, matching the Go call site. */
  debateType: string
  topic: string
  opponentName: string
  result: DebateResultStatus
  history: DebateMessage[]
}

/**
 * Everything the vs-bot handlers need from storage. Every method is
 * optional except `createDebate` and `getLatestDebate`, so a host can start
 * with bare persistence and add transcripts or scoring later.
 */
export interface DebateStore {
  /** Insert a new debate and return its id. Go: `CreateDebateService`. */
  createDebate(debate: Omit<DebateVsBotRecord, "id">): Promise<string>
  /** Fetch one debate by id. Go: the concede handler's `FindOne`. */
  getDebate(id: string): Promise<DebateVsBotRecord | null>
  /** The user's most recent debate. Go: `GetLatestDebateVsBot`. */
  getLatestDebate(email: string): Promise<DebateVsBotRecord | null>
  /** Append the bot's turn to a debate's history. Go: `SaveDebateVsBot`. */
  appendMessage?(id: string, message: DebateMessage): Promise<void>
  /** Record a debate's outcome. Go: `UpdateDebateVsBotOutcome`. */
  setOutcome(id: string, outcome: string): Promise<void>
  /** Store a finished round's transcript. Go: `SaveDebateTranscript`. */
  saveTranscript?(input: DebateTranscriptInput): Promise<void>
  /** Read the user's score/badges/streak, for the award computation. */
  getGamificationProfile?(userId: string): Promise<GamificationProfile | null>
  /** Persist a computed award. Go: the `$inc`/`$addToSet` writes. */
  applyGamificationAward?(
    userId: string,
    award: GamificationAward,
    context: { debateType: string; topic: string; result: DebateResultStatus },
  ): Promise<void>
}

/**
 * A process-local store. Useful for tests and for running the round without
 * a database; nothing survives a restart, so hosts that care about history
 * should supply their own implementation.
 */
export function createInMemoryDebateStore(): DebateStore {
  const debates = new Map<string, DebateVsBotRecord>()
  const profiles = new Map<string, GamificationProfile>()
  let counter = 0

  return {
    async createDebate(debate) {
      const id = `mem_${Date.now().toString(36)}_${(counter++).toString(36)}`
      debates.set(id, { ...debate, id })
      return id
    },
    async getDebate(id) {
      return debates.get(id) ?? null
    },
    async getLatestDebate(email) {
      let latest: DebateVsBotRecord | null = null
      for (const debate of debates.values()) {
        if (debate.email !== email) continue
        if (!latest || debate.createdAt >= latest.createdAt) latest = debate
      }
      return latest
    },
    async appendMessage(id, message) {
      const debate = debates.get(id)
      if (debate) debate.history = [...debate.history, message]
    },
    async setOutcome(id, outcome) {
      const debate = debates.get(id)
      if (debate) debate.outcome = outcome
    },
    async getGamificationProfile(userId) {
      return profiles.get(userId) ?? { score: 0, badges: [], currentStreak: 0 }
    },
    async applyGamificationAward(userId, award) {
      const profile = profiles.get(userId) ?? { score: 0, badges: [], currentStreak: 0 }
      profiles.set(userId, {
        score: award.newScore,
        badges: [...profile.badges, ...award.badgesAwarded],
        currentStreak: profile.currentStreak,
      })
    },
  }
}
