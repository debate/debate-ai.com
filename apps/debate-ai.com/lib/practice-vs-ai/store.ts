/**
 * @fileoverview Drizzle-backed `DebateStore` for the ported Practice vs AI
 * backend — the D1/libSQL replacement for the Go server's Mongo
 * `debatevsbot` collection.
 *
 * `debate-practice-vs-ai` defines the interface and ships only an in-memory
 * implementation, so persistence is the host app's to supply. This one keeps
 * the full `DebateVsBotRecord` in the row's `data` JSON blob — the same
 * pattern `saved_flows`/`saved_rounds` use — and lifts owner, bot, topic,
 * outcome and result into columns so the round list can be queried.
 *
 * Transcripts and gamification are deliberately not implemented here: this
 * app has no `score`/`badges` columns on `user`, so `recordCompletedRound`'s
 * optional hooks stay unset and the round's `result` is recorded on the
 * debate row instead. `computeGamificationAward` remains exported from the
 * package for whenever those columns land.
 */

import { and, desc, eq } from "drizzle-orm"
import type {
  DebateMessage,
  DebateStore,
  DebateVsBotRecord,
} from "debate-practice-vs-ai"
import { resolveResultStatus } from "debate-practice-vs-ai"
import { getDBFromContext } from "@/lib/database/context"
import { practiceVsAiDebates } from "@/lib/database/schema"

/** Rebuild a record from a row, tolerating a `data` blob that fails to parse. */
function rowToRecord(row: {
  id: number
  email: string
  botName: string
  topic: string
  outcome: string
  data: string
  createdAt: Date
}): DebateVsBotRecord {
  let parsed: Partial<DebateVsBotRecord> = {}
  try {
    parsed = JSON.parse(row.data) as Partial<DebateVsBotRecord>
  } catch {
    // A corrupt blob still yields a usable record from the columns.
  }
  return {
    id: String(row.id),
    email: row.email,
    botName: row.botName,
    botLevel: parsed.botLevel ?? "",
    topic: row.topic,
    stance: parsed.stance ?? "",
    history: parsed.history ?? [],
    phaseTimings: parsed.phaseTimings ?? [],
    outcome: row.outcome || undefined,
    createdAt: parsed.createdAt ?? Math.floor(row.createdAt.getTime() / 1000),
  }
}

const SELECTED = {
  id: practiceVsAiDebates.id,
  email: practiceVsAiDebates.email,
  botName: practiceVsAiDebates.botName,
  topic: practiceVsAiDebates.topic,
  outcome: practiceVsAiDebates.outcome,
  data: practiceVsAiDebates.data,
  createdAt: practiceVsAiDebates.createdAt,
}

/**
 * Build a store scoped to one signed-in user. Scoping at construction is what
 * keeps every read and write in the handlers from reaching another account's
 * rows — the Go server relied on the same thing via the token's email.
 */
export function createPracticeVsAiStore(userId: string): DebateStore {
  return {
    async createDebate(debate) {
      const db = await getDBFromContext()
      const [inserted] = await db
        .insert(practiceVsAiDebates)
        .values({
          userId,
          email: debate.email,
          botName: debate.botName,
          topic: debate.topic,
          outcome: debate.outcome ?? "",
          result: "pending",
          data: JSON.stringify(debate),
        })
        .returning({ id: practiceVsAiDebates.id })
      return String(inserted.id)
    },

    async getDebate(id) {
      const numericId = Number(id)
      if (!Number.isInteger(numericId)) return null
      const db = await getDBFromContext()
      const [row] = await db
        .select(SELECTED)
        .from(practiceVsAiDebates)
        .where(
          and(eq(practiceVsAiDebates.id, numericId), eq(practiceVsAiDebates.userId, userId)),
        )
        .limit(1)
      return row ? rowToRecord(row) : null
    },

    async getLatestDebate() {
      const db = await getDBFromContext()
      const [row] = await db
        .select(SELECTED)
        .from(practiceVsAiDebates)
        .where(eq(practiceVsAiDebates.userId, userId))
        .orderBy(desc(practiceVsAiDebates.createdAt), desc(practiceVsAiDebates.id))
        .limit(1)
      return row ? rowToRecord(row) : null
    },

    async appendMessage(id: string, message: DebateMessage) {
      const numericId = Number(id)
      if (!Number.isInteger(numericId)) return
      const db = await getDBFromContext()
      const [row] = await db
        .select(SELECTED)
        .from(practiceVsAiDebates)
        .where(
          and(eq(practiceVsAiDebates.id, numericId), eq(practiceVsAiDebates.userId, userId)),
        )
        .limit(1)
      if (!row) return

      const record = rowToRecord(row)
      record.history = [...record.history, message]
      await db
        .update(practiceVsAiDebates)
        .set({ data: JSON.stringify(record), updatedAt: new Date() })
        .where(eq(practiceVsAiDebates.id, numericId))
    },

    async setOutcome(id: string, outcome: string) {
      const numericId = Number(id)
      if (!Number.isInteger(numericId)) return
      const db = await getDBFromContext()
      await db
        .update(practiceVsAiDebates)
        .set({
          outcome,
          // The Go controller derived the same status from the judge reply to
          // decide the round's gamification award; storing it here makes a
          // finished round's win/loss readable without re-parsing the verdict.
          result: outcome === "User conceded" ? "loss" : resolveResultStatus(outcome),
          updatedAt: new Date(),
        })
        .where(
          and(eq(practiceVsAiDebates.id, numericId), eq(practiceVsAiDebates.userId, userId)),
        )
    },
  }
}
