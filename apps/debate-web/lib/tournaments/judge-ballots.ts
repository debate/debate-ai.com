/**
 * Judge ballots from the tournaments UI's Ballot tab, and from agents calling
 * the `submit_judge_ballot` tool — both land on `/api/judge-ballots`
 * (`app/api/judge-ballots/route.ts`).
 *
 * The rule that matters: a ballot is accepted only when the email of the
 * Tabroom account it is filed under matches the email of the signed-in Debate
 * AI user. The UI checks this as the judge types; this module checks it again
 * on the server, where it counts.
 *
 * Every accepted ballot is stored in `judge_ballot` (see
 * `@debate/tournaments/ballots`). With destination `tabroom` it is also
 * forwarded to Tabroom, at the endpoint named by the `TABROOM_BALLOT_URL`
 * environment variable, authorized with the judge's own Tabroom token from the
 * `x-tabroom-token` request header. That token is passed through and never
 * stored, and no Tabroom credential lives in this repo. When the variable is
 * unset the forward is reported as `unavailable` and the ballot is kept here.
 */

import { sql } from "drizzle-orm"
import {
  JUDGE_BALLOT_INDEX_SQL,
  JUDGE_BALLOT_TABLE_SQL,
  emailsMatch,
  normalizeEmail,
  validateJudgeBallot,
  type BallotAccountCheck,
  type BallotSpeakerPoints,
  type JudgeBallotInput,
  type StoredJudgeBallot,
} from "@debate/tournaments/ballots"
import { getCloudflareContext, getDBFromContext } from "@/lib/database/context"

export const TABROOM_TOKEN_HEADER = "x-tabroom-token"
const TABROOM_TIMEOUT_MS = 15_000

/** The signed-in Debate AI user, as the route reads it from the session. */
export interface BallotUser {
  id: string
  email: string
  name?: string | null
}

/** Storage behind the API, injectable so tests run without a database. */
export interface BallotStore {
  insert(ballot: StoredJudgeBallot, userId: string): Promise<void>
  list(userId: string, tournId?: number): Promise<StoredJudgeBallot[]>
  /** A hosted Tabroom person with this email, if the hosted Tabroom tables have one. */
  findTabroomPerson(email: string): Promise<BallotAccountCheck["tabroomPerson"]>
}

export type TabroomForward = (
  ballot: JudgeBallotInput,
  token: string,
) => Promise<{ status: "sent" | "failed" | "unavailable"; detail: string | null }>

export interface BallotResult {
  status: number
  body: Record<string, unknown>
}

/** The Tabroom endpoint ballots are forwarded to, or null when none is configured. */
export function tabroomBallotUrl(): string | null {
  const env = getCloudflareContext()?.env as Record<string, unknown> | undefined
  const value = (env?.TABROOM_BALLOT_URL ?? process.env.TABROOM_BALLOT_URL) as string | undefined
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

/** Forwards a ballot to Tabroom with the judge's own token. */
export function createTabroomForward(url: string | null, fetchImpl: typeof fetch = fetch): TabroomForward {
  return async (ballot, token) => {
    if (!url) return { status: "unavailable", detail: "Tabroom ballot submission is not configured on this server." }
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(ballot),
        signal: AbortSignal.timeout(TABROOM_TIMEOUT_MS),
      })
      if (res.ok) return { status: "sent", detail: null }
      const body = (await res.json().catch(() => null)) as { detail?: string; message?: string; error?: string } | null
      const reason = body?.detail || body?.message || body?.error
      return { status: "failed", detail: `Tabroom answered ${res.status}${reason ? `: ${String(reason).slice(0, 300)}` : ""}` }
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError"
      return { status: "failed", detail: timedOut ? "Tabroom did not answer in time." : "Tabroom could not be reached." }
    }
  }
}

/** Whether `user` may submit ballots, and under which Tabroom account. */
export async function checkBallotAccount(
  user: BallotUser | null,
  store: Pick<BallotStore, "findTabroomPerson">,
  tabroomForwarding: boolean,
): Promise<BallotAccountCheck> {
  if (!user?.email) return { signedIn: false, email: null, tabroomPerson: null, tabroomForwarding }
  return {
    signedIn: true,
    email: normalizeEmail(user.email),
    tabroomPerson: await store.findTabroomPerson(user.email),
    tabroomForwarding,
  }
}

/** Validates, checks the email match, stores, and (for `tabroom`) forwards one ballot. */
export async function submitJudgeBallot({
  user,
  raw,
  tabroomToken,
  store,
  forward,
  now = () => new Date(),
  newId = () => crypto.randomUUID(),
}: {
  user: BallotUser | null
  raw: unknown
  tabroomToken?: string | null
  store: Pick<BallotStore, "insert">
  forward: TabroomForward
  now?: () => Date
  newId?: () => string
}): Promise<BallotResult> {
  if (!user?.email) return { status: 401, body: { error: "Sign in to Debate AI to submit a ballot." } }

  const checked = validateJudgeBallot(raw)
  if (!checked.ok) return { status: 400, body: { error: "The ballot is incomplete.", errors: checked.errors } }
  const ballot = checked.ballot

  if (!emailsMatch(ballot.tabroomEmail, user.email)) {
    return {
      status: 403,
      body: {
        error: `The Tabroom account email (${ballot.tabroomEmail}) does not match the email you are signed in to Debate AI with (${normalizeEmail(user.email)}).`,
      },
    }
  }

  const token = tabroomToken?.trim()
  if (ballot.destination === "tabroom" && !token) {
    return { status: 400, body: { error: "Sending a ballot to Tabroom needs your Tabroom token." } }
  }

  const sent = ballot.destination === "tabroom" && token ? await forward(ballot, token) : null
  const stored: StoredJudgeBallot = {
    ...ballot,
    id: newId(),
    speakerPoints: ballot.speakerPoints ?? [],
    judgeEmail: normalizeEmail(user.email),
    tabroomStatus: sent?.status ?? null,
    tabroomDetail: sent?.detail ?? null,
    createdAt: now().toISOString(),
  }
  await store.insert(stored, user.id)
  return { status: 201, body: { ballot: stored } }
}

// ---------------------------------------------------------------------------
// D1 / libSQL storage
// ---------------------------------------------------------------------------

type Db = Awaited<ReturnType<typeof getDBFromContext>>

interface BallotRow {
  id: string
  judge_email: string
  tabroom_email: string
  tourn_id: number
  tournament_name: string | null
  event: string
  round: string
  room: string | null
  aff: string
  neg: string
  winner: "aff" | "neg"
  low_point_win: number
  speaker_points: string
  rfd: string | null
  destination: "local" | "tabroom"
  tabroom_status: StoredJudgeBallot["tabroomStatus"]
  tabroom_detail: string | null
  created_at: string
}

function parsePoints(json: string): BallotSpeakerPoints[] {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function rowToBallot(row: BallotRow): StoredJudgeBallot {
  return {
    id: row.id,
    tournId: Number(row.tourn_id),
    ...(row.tournament_name ? { tournamentName: row.tournament_name } : {}),
    event: row.event,
    round: row.round,
    ...(row.room ? { room: row.room } : {}),
    aff: row.aff,
    neg: row.neg,
    winner: row.winner,
    ...(row.low_point_win ? { lowPointWin: true } : {}),
    speakerPoints: parsePoints(row.speaker_points),
    ...(row.rfd ? { rfd: row.rfd } : {}),
    tabroomEmail: row.tabroom_email,
    destination: row.destination,
    judgeEmail: row.judge_email,
    tabroomStatus: row.tabroom_status ?? null,
    tabroomDetail: row.tabroom_detail ?? null,
    createdAt: row.created_at,
  }
}

const isMissingTable = (error: unknown) =>
  /no such table/i.test(String((error as Error)?.message) + String((error as { cause?: unknown })?.cause))

let tableReady: Promise<void> | null = null

/**
 * Creates `judge_ballot` once per isolate. The deploy's migration
 * (`packages/debate-tournaments/migrations/0002_judge_ballots.sql`) normally
 * has already, but a local libSQL database may never have run it.
 */
function ensureTable(db: Db): Promise<void> {
  tableReady ??= (async () => {
    await db.run(sql.raw(JUDGE_BALLOT_TABLE_SQL))
    await db.run(sql.raw(JUDGE_BALLOT_INDEX_SQL))
  })().catch((error) => {
    tableReady = null
    throw error
  })
  return tableReady
}

export function createD1BallotStore(db: Db): BallotStore {
  return {
    async insert(b, userId) {
      await ensureTable(db)
      await db.run(sql`
        INSERT INTO judge_ballot (
          id, user_id, judge_email, tabroom_email, tourn_id, tournament_name, event, round, room, aff, neg,
          winner, low_point_win, speaker_points, rfd, destination, tabroom_status, tabroom_detail, created_at
        ) VALUES (
          ${b.id}, ${userId}, ${b.judgeEmail}, ${b.tabroomEmail}, ${b.tournId}, ${b.tournamentName ?? null},
          ${b.event}, ${b.round}, ${b.room ?? null}, ${b.aff}, ${b.neg}, ${b.winner}, ${b.lowPointWin ? 1 : 0},
          ${JSON.stringify(b.speakerPoints)}, ${b.rfd ?? null}, ${b.destination}, ${b.tabroomStatus},
          ${b.tabroomDetail}, ${b.createdAt}
        )`)
    },
    async list(userId, tournId) {
      await ensureTable(db)
      const rows = (await db.all(
        tournId
          ? sql`SELECT * FROM judge_ballot WHERE user_id = ${userId} AND tourn_id = ${tournId} ORDER BY created_at DESC LIMIT 200`
          : sql`SELECT * FROM judge_ballot WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 200`,
      )) as BallotRow[]
      return rows.map(rowToBallot)
    },
    async findTabroomPerson(email) {
      try {
        const rows = (await db.all(
          sql`SELECT id, first, last, email FROM person WHERE email = ${normalizeEmail(email)} LIMIT 1`,
        )) as Array<{ id: number; first: string | null; last: string | null; email: string }>
        const row = rows[0]
        if (!row) return null
        return { id: Number(row.id), name: [row.first, row.last].filter(Boolean).join(" ") || row.email, email: row.email }
      } catch (error) {
        // A database without the hosted Tabroom tables has no Tabroom people.
        if (isMissingTable(error)) return null
        throw error
      }
    },
  }
}
