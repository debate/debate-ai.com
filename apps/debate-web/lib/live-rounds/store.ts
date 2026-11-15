/**
 * @fileoverview Live round radio streams (`/api/live-rounds`): a round with
 * **Live stream** on broadcasts each speaker's voice during their speeches as
 * short audio segments, and the video library lists the streams so anyone can
 * tune in live or play the replay afterwards. Protocol and client:
 * `@debate-ai/timer`'s `recorder/live-radio.ts`.
 *
 * - `live_rounds` — one row per stream (id = the round's flattened slug):
 *   labels for the library, who may broadcast (`debaters`, plus the owner who
 *   switched it on), who may listen to a private round (`invitees`), status,
 *   and running totals.
 * - `live_round_segments` — one row per segment, numbered on arrival; the
 *   audio itself is in R2 (the `ROUND_RECORDINGS` bucket) under
 *   `live-rounds/<id>/<seq>.<ext>`.
 *
 * The tables are created here on first use: the app has no tracked
 * migrations (see `lib/database/ensure-columns.ts`).
 *
 * @module lib/live-rounds/store
 */

import { sql } from "drizzle-orm"
import {
  ON_AIR_WINDOW_MS,
  isLiveStreamId,
  liveStreamIdForSlug,
  type LiveRoundRegistration,
  type LiveRoundSummary,
  type LiveSegment,
  type LiveStreamStatus,
} from "@debate-ai/timer/src/recorder/live-radio"
import type { getDBFromContext } from "@/lib/database/context"

type Database = Awaited<ReturnType<typeof getDBFromContext>>

/** R2 prefix of every live segment. */
export const LIVE_ROUNDS_PREFIX = "live-rounds/"

/** A stream with no new audio or edits for this long is shown as a replay. */
export const LIVE_STALE_MS = 2 * 60 * 60 * 1000

/** Most segments one stream keeps — about seven hours at 5 s each. */
export const MAX_SEGMENTS_PER_STREAM = 5_000

/** Most segments one detail read returns. */
export const MAX_SEGMENTS_PER_READ = 1_000

/** Streams the library lists. */
export const MAX_LISTED_STREAMS = 24

const CREATE_STREAMS_SQL = `CREATE TABLE IF NOT EXISTS "live_rounds" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_id" text NOT NULL,
  "title" text NOT NULL,
  "tournament_name" text NOT NULL DEFAULT '',
  "round_level" text NOT NULL DEFAULT '',
  "aff" text NOT NULL DEFAULT '',
  "neg" text NOT NULL DEFAULT '',
  "debaters" text NOT NULL DEFAULT '[]',
  "invitees" text NOT NULL DEFAULT '[]',
  "is_private" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'live',
  "current_speech" text,
  "segment_count" integer NOT NULL DEFAULT 0,
  "duration_ms" integer NOT NULL DEFAULT 0,
  "last_segment_at" integer,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
)`

const CREATE_SEGMENTS_SQL = `CREATE TABLE IF NOT EXISTS "live_round_segments" (
  "stream_id" text NOT NULL,
  "seq" integer NOT NULL,
  "speech" text NOT NULL,
  "r2_key" text NOT NULL,
  "content_type" text NOT NULL,
  "duration_ms" integer NOT NULL DEFAULT 0,
  "created_by" text,
  "created_at" integer NOT NULL,
  PRIMARY KEY ("stream_id", "seq")
)`

const CREATE_LIST_INDEX_SQL = `CREATE INDEX IF NOT EXISTS "live_rounds_listed_idx" ON "live_rounds" ("is_private", "updated_at")`

let tablesReady: Promise<void> | null = null

export function ensureLiveRoundTables(db: Database): Promise<void> {
  tablesReady ??= (async () => {
    await db.run(sql.raw(CREATE_STREAMS_SQL))
    await db.run(sql.raw(CREATE_SEGMENTS_SQL))
    await db.run(sql.raw(CREATE_LIST_INDEX_SQL))
  })().catch((error) => {
    tablesReady = null
    throw error
  })
  return tablesReady
}

/** One `live_rounds` row as stored. */
export interface LiveRoundRow {
  id: string
  owner_id: string
  title: string
  tournament_name: string
  round_level: string
  aff: string
  neg: string
  debaters: string
  invitees: string
  is_private: number
  status: string
  current_speech: string | null
  segment_count: number
  duration_ms: number
  last_segment_at: number | null
  created_at: number
  updated_at: number
}

/** Who is asking: the signed-in account's id and email, or nobody. */
export interface LiveViewer {
  userId: string
  email: string
}

const lower = (value: string) => value.trim().toLowerCase()

function parseList(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []
  } catch {
    return []
  }
}

/** The status a reader sees: a "live" stream nobody has touched in {@link LIVE_STALE_MS} reads as ended. */
export function effectiveStatus(row: Pick<LiveRoundRow, "status" | "updated_at" | "last_segment_at">, now: number): LiveStreamStatus {
  if (row.status === "off") return "off"
  if (row.status !== "live") return "ended"
  const lastActivity = Math.max(row.updated_at, row.last_segment_at ?? 0)
  return now - lastActivity > LIVE_STALE_MS ? "ended" : "live"
}

export function toSummary(row: LiveRoundRow, now: number): LiveRoundSummary {
  const status = effectiveStatus(row, now)
  const onAir = status === "live" && row.last_segment_at !== null && now - row.last_segment_at <= ON_AIR_WINDOW_MS
  return {
    id: row.id,
    title: row.title,
    tournamentName: row.tournament_name,
    roundLevel: row.round_level,
    aff: row.aff,
    neg: row.neg,
    // A stream switched off keeps its replay: it reads as ended to listeners.
    status: status === "off" ? "ended" : status,
    onAirSpeech: onAir ? row.current_speech : null,
    segmentCount: Number(row.segment_count),
    durationMs: Number(row.duration_ms),
    createdAt: new Date(Number(row.created_at)).toISOString(),
    updatedAt: new Date(Number(row.updated_at)).toISOString(),
  }
}

/** Whether `viewer` may broadcast into the stream: its owner, or a debater on the invite. */
export function canBroadcast(row: Pick<LiveRoundRow, "owner_id" | "debaters">, viewer: LiveViewer | null): boolean {
  if (!viewer) return false
  if (row.owner_id === viewer.userId) return true
  const email = lower(viewer.email)
  return !!email && parseList(row.debaters).some((entry) => lower(entry) === email)
}

/** Whether `viewer` may listen: anyone to a public stream; the owner and invitees to a private one. */
export function canListen(row: Pick<LiveRoundRow, "owner_id" | "debaters" | "invitees" | "is_private">, viewer: LiveViewer | null): boolean {
  if (!Number(row.is_private)) return true
  if (!viewer) return false
  if (canBroadcast(row, viewer)) return true
  const email = lower(viewer.email)
  return !!email && parseList(row.invitees).some((entry) => lower(entry) === email)
}

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max) : ""

const list = (value: unknown) =>
  Array.isArray(value) ? value.map((entry) => text(entry, 200)).filter(Boolean).slice(0, 40) : []

/** Validates a registration body; the stream id comes from its slug. */
export function parseRegistration(
  body: unknown,
): { ok: true; id: string; value: LiveRoundRegistration } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Send the round as JSON." }
  const raw = body as Record<string, unknown>
  const slug = text(raw.slug, 300)
  const id = liveStreamIdForSlug(slug)
  if (!id) return { ok: false, error: "The round needs a slug (save it with a tournament name first)." }
  const tournamentName = text(raw.tournamentName, 160)
  const roundLevel = text(raw.roundLevel, 80)
  return {
    ok: true,
    id,
    value: {
      slug,
      title: text(raw.title, 240) || [tournamentName, roundLevel].filter(Boolean).join(" - ") || "Live round",
      tournamentName,
      roundLevel,
      aff: text(raw.aff, 120),
      neg: text(raw.neg, 120),
      debaters: list(raw.debaters),
      invitees: list(raw.invitees),
      isPrivate: raw.isPrivate === true,
      enabled: raw.enabled !== false,
    },
  }
}

/** A speech label safe to store: printable, at most 40 characters. */
export function cleanSpeechName(value: string | null): string {
  return text(value, 40) || "Speech"
}

export async function getLiveRound(db: Database, id: string): Promise<LiveRoundRow | null> {
  if (!isLiveStreamId(id)) return null
  await ensureLiveRoundTables(db)
  const [row] = (await db.all(sql`SELECT * FROM live_rounds WHERE id = ${id} LIMIT 1`)) as LiveRoundRow[]
  return row ?? null
}

export type RegisterResult =
  | { ok: true; row: LiveRoundRow; created: boolean }
  | { ok: false; status: 403; error: string }

/**
 * Creates the stream, or updates it for its owner or one of its debaters.
 * Switching on reopens an ended stream; switching off hides a stream with no
 * audio and keeps any replay.
 */
export async function registerLiveRound(
  db: Database,
  id: string,
  registration: LiveRoundRegistration,
  viewer: LiveViewer,
  now = Date.now(),
): Promise<RegisterResult> {
  await ensureLiveRoundTables(db)
  const existing = await getLiveRound(db, id)
  const status = registration.enabled ? "live" : "off"
  const debaters = JSON.stringify(registration.debaters)
  const invitees = JSON.stringify(registration.invitees)
  const isPrivate = registration.isPrivate ? 1 : 0

  if (!existing) {
    await db.run(sql`INSERT INTO live_rounds
      (id, owner_id, title, tournament_name, round_level, aff, neg, debaters, invitees, is_private, status, created_at, updated_at)
      VALUES (${id}, ${viewer.userId}, ${registration.title}, ${registration.tournamentName}, ${registration.roundLevel},
              ${registration.aff}, ${registration.neg}, ${debaters}, ${invitees}, ${isPrivate}, ${status}, ${now}, ${now})`)
    return { ok: true, row: (await getLiveRound(db, id))!, created: true }
  }

  if (!canBroadcast(existing, viewer)) {
    return { ok: false, status: 403, error: "Only the round's debaters can change its live stream." }
  }
  await db.run(sql`UPDATE live_rounds SET
      title = ${registration.title}, tournament_name = ${registration.tournamentName}, round_level = ${registration.roundLevel},
      aff = ${registration.aff}, neg = ${registration.neg}, debaters = ${debaters}, invitees = ${invitees},
      is_private = ${isPrivate}, status = ${status}, updated_at = ${now}
    WHERE id = ${id}`)
  return { ok: true, row: (await getLiveRound(db, id))!, created: false }
}

/** Public streams for the library: live ones first, then the newest replays. Streams with no audio show only while live. */
export async function listLiveRounds(db: Database, now = Date.now()): Promise<LiveRoundSummary[]> {
  await ensureLiveRoundTables(db)
  const rows = (await db.all(
    sql`SELECT * FROM live_rounds
        WHERE is_private = 0 AND (segment_count > 0 OR status = 'live')
        ORDER BY updated_at DESC LIMIT ${MAX_LISTED_STREAMS * 2}`,
  )) as LiveRoundRow[]
  const summaries = rows
    .map((row) => toSummary(row, now))
    .filter((summary) => summary.status === "live" || summary.segmentCount > 0)
  const rank = (s: LiveRoundSummary) => (s.onAirSpeech ? 0 : s.status === "live" ? 1 : 2)
  return summaries
    .sort((a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_LISTED_STREAMS)
}

export async function listSegments(db: Database, id: string, after: number): Promise<LiveSegment[]> {
  await ensureLiveRoundTables(db)
  const rows = (await db.all(
    sql`SELECT seq, speech, duration_ms, created_at FROM live_round_segments
        WHERE stream_id = ${id} AND seq > ${after} ORDER BY seq LIMIT ${MAX_SEGMENTS_PER_READ}`,
  )) as Array<{ seq: number; speech: string; duration_ms: number; created_at: number }>
  return rows.map((row) => ({
    seq: Number(row.seq),
    speech: String(row.speech),
    durationMs: Number(row.duration_ms),
    createdAt: new Date(Number(row.created_at)).toISOString(),
  }))
}

export async function getSegment(
  db: Database,
  id: string,
  seq: number,
): Promise<{ r2_key: string; content_type: string } | null> {
  await ensureLiveRoundTables(db)
  const [row] = (await db.all(
    sql`SELECT r2_key, content_type FROM live_round_segments WHERE stream_id = ${id} AND seq = ${seq} LIMIT 1`,
  )) as Array<{ r2_key: string; content_type: string }>
  return row ?? null
}

/** File extension for a segment's content type. */
export function segmentExtension(contentType: string): string {
  if (/ogg/i.test(contentType)) return "ogg"
  if (/mp4|aac|m4a/i.test(contentType)) return "m4a"
  return "webm"
}

/** The R2 key of one segment. */
export function segmentKey(id: string, seq: number, contentType: string): string {
  return `${LIVE_ROUNDS_PREFIX}${id}/${String(seq).padStart(6, "0")}.${segmentExtension(contentType)}`
}

export interface SegmentBucket {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>
}

export type AppendResult = { ok: true; seq: number } | { ok: false; status: 409 | 413; error: string }

/**
 * Stores one segment and numbers it after the last. Two broadcasters racing
 * for the same number (they shouldn't — one speaker at a time) retry on the
 * next one.
 */
export async function appendSegment(
  db: Database,
  bucket: SegmentBucket,
  row: LiveRoundRow,
  segment: { body: ArrayBuffer; contentType: string; speech: string; durationMs: number; userId: string },
  now = Date.now(),
): Promise<AppendResult> {
  await ensureLiveRoundTables(db)
  if (Number(row.segment_count) >= MAX_SEGMENTS_PER_STREAM) {
    return { ok: false, status: 413, error: "This stream is as long as a stream can be." }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const [next] = (await db.all(
      sql`SELECT COALESCE(MAX(seq), -1) + 1 AS seq FROM live_round_segments WHERE stream_id = ${row.id}`,
    )) as Array<{ seq: number }>
    const seq = Number(next?.seq ?? 0)
    const key = segmentKey(row.id, seq, segment.contentType)
    try {
      await db.run(sql`INSERT INTO live_round_segments (stream_id, seq, speech, r2_key, content_type, duration_ms, created_by, created_at)
        VALUES (${row.id}, ${seq}, ${segment.speech}, ${key}, ${segment.contentType}, ${segment.durationMs}, ${segment.userId}, ${now})`)
    } catch (error) {
      if (/UNIQUE|PRIMARY KEY|constraint/i.test(String((error as Error)?.message ?? error))) continue
      throw error
    }
    await bucket.put(key, segment.body, { httpMetadata: { contentType: segment.contentType } })
    await db.run(sql`UPDATE live_rounds SET
        segment_count = segment_count + 1, duration_ms = duration_ms + ${segment.durationMs},
        current_speech = ${segment.speech}, last_segment_at = ${now}, updated_at = ${now}
      WHERE id = ${row.id}`)
    return { ok: true, seq }
  }
  return { ok: false, status: 409, error: "Another segment took this slot; send it again." }
}
