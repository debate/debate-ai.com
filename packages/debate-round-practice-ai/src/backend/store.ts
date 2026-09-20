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

import { computeGamificationAward } from "./gamification"
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
  /**
   * The user's past debates, newest first. Not part of the Go port — added
   * so a host can offer a debate-history view now that every round is
   * already persisted in full. Optional so a bare store (like the "omits
   * gamification" test double) still satisfies the interface.
   */
  listDebates?(email: string): Promise<DebateVsBotRecord[]>
  /** Append the bot's turn to a debate's history. Go: `SaveDebateVsBot`. */
  appendMessage?(id: string, message: DebateMessage): Promise<void>
  /** Record a debate's outcome. Go: `UpdateDebateVsBotOutcome`. */
  setOutcome(id: string, outcome: string): Promise<void>
  /** Store a finished round's transcript. Go: `SaveDebateTranscript`. */
  saveTranscript?(input: DebateTranscriptInput): Promise<void>
  /**
   * Read the user's score/badges/streak. Not used by `applyGamificationAward`
   * itself (which re-reads the row fresh right before writing, so two rounds
   * finishing concurrently can't clobber each other's points) — kept as a
   * separate capability probe and for hosts that want to display a profile.
   */
  getGamificationProfile?(userId: string): Promise<GamificationProfile | null>
  /**
   * Compute and persist a round's award. Implementations must read the
   * user's current score/badges immediately before writing (mirroring the
   * Go `$inc`/`$addToSet` writes' atomicity) rather than trusting a
   * previously-fetched `GamificationProfile`, so that two rounds finishing
   * close together each keep their points instead of the second write
   * silently overwriting the first.
   */
  applyGamificationAward?(
    userId: string,
    context: { debateType: string; topic: string; result: DebateResultStatus },
  ): Promise<GamificationAward>
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
    async listDebates(email) {
      return [...debates.values()]
        .filter((debate) => debate.email === email)
        .sort((a, b) => b.createdAt - a.createdAt)
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
    async applyGamificationAward(userId, context) {
      // Re-read the profile right before writing rather than trusting a
      // caller-supplied award, so two concurrent awards for the same user
      // each get computed against the other's write instead of racing.
      const profile = profiles.get(userId) ?? { score: 0, badges: [], currentStreak: 0 }
      const award = computeGamificationAward(profile, context.result)
      profiles.set(userId, {
        score: award.newScore,
        badges: [...new Set([...profile.badges, ...award.badgesAwarded])],
        currentStreak: profile.currentStreak,
      })
      return award
    },
  }
}
