import { NextRequest, NextResponse } from "next/server"
import { MAX_LIVE_SEGMENT_BYTES, isLiveStreamId } from "@debate-ai/timer/src/recorder/live-radio"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getSession } from "@/lib/auth/session"
import { getDBFromContext } from "@/lib/database/context"
import { getRoundRecordingsBucket } from "@/lib/round-recordings/storage"
import {
  appendSegment,
  canBroadcast,
  canListen,
  cleanSpeechName,
  getLiveRound,
  listLiveRounds,
  listSegments,
  parseRegistration,
  registerLiveRound,
  toSummary,
  type LiveViewer,
} from "@/lib/live-rounds/store"

/**
 * Live round radio (Round Editor → **Live stream**; protocol in
 * `@debate-ai/timer`'s `recorder/live-radio.ts`, storage in
 * `lib/live-rounds/store.ts`).
 *
 * GET — the public streams for the video library: `{ streams }`, live first.
 * GET ?id=…&after=N — one stream and its segments numbered above N:
 *   `{ stream, segments }`. A private round answers only its owner and invitees.
 * PUT `{ slug, title, …, enabled }` — switches a round's stream on or off
 *   (signed in; the first caller owns it, later changes need the owner or a
 *   debater on the invite). Returns `{ id, stream }`.
 * POST ?id=…&speech=1AC&durationMs=5000 — body is one audio segment; only the
 *   owner or a debater may send, while the stream is on. Returns `{ seq }`.
 */

async function viewer(): Promise<LiveViewer | null> {
  const session = await getSession()
  return session ? { userId: session.user.id, email: session.user.email ?? "" } : null
}

const AUDIO_TYPE = /^audio\/(webm|ogg|mp4|aac|mpeg)$/i

export const GET = withRouteErrors("GET /api/live-rounds", async (req: NextRequest) => {
  const params = new URL(req.url).searchParams
  const db = await getDBFromContext()
  const id = params.get("id")
  if (id === null) {
    return NextResponse.json({ streams: await listLiveRounds(db) }, { headers: { "cache-control": "no-cache" } })
  }
  if (!isLiveStreamId(id)) return NextResponse.json({ error: "Invalid stream id." }, { status: 400 })
  const row = await getLiveRound(db, id)
  if (!row || !canListen(row, await viewer())) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const after = Number.parseInt(params.get("after") ?? "-1", 10)
  const segments = await listSegments(db, id, Number.isFinite(after) ? after : -1)
  return NextResponse.json({ stream: toSummary(row, Date.now()), segments }, { headers: { "cache-control": "no-cache" } })
})

export const PUT = withRouteErrors("PUT /api/live-rounds", async (req: NextRequest) => {
  const who = await viewer()
  if (!who) return NextResponse.json({ error: "Sign in to live stream a round." }, { status: 401 })
  const parsed = parseRegistration(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const result = await registerLiveRound(await getDBFromContext(), parsed.id, parsed.value, who)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ id: parsed.id, stream: toSummary(result.row, Date.now()) }, { status: result.created ? 201 : 200 })
})

export const POST = withRouteErrors("POST /api/live-rounds", async (req: NextRequest) => {
  const who = await viewer()
  if (!who) return NextResponse.json({ error: "Sign in to broadcast." }, { status: 401 })
  const params = new URL(req.url).searchParams
  const id = params.get("id") ?? ""
  if (!isLiveStreamId(id)) return NextResponse.json({ error: "Invalid stream id." }, { status: 400 })
  const contentType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
  if (!AUDIO_TYPE.test(contentType)) return NextResponse.json({ error: "Only audio segments can be broadcast." }, { status: 415 })

  const bucket = getRoundRecordingsBucket()
  if (!bucket) {
    return NextResponse.json(
      { error: "Recording storage is not configured", details: "Bind an R2 bucket as ROUND_RECORDINGS in wrangler.jsonc." },
      { status: 503 },
    )
  }
  const db = await getDBFromContext()
  const row = await getLiveRound(db, id)
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canBroadcast(row, who)) return NextResponse.json({ error: "Only the round's debaters can broadcast." }, { status: 403 })
  if (row.status === "off") return NextResponse.json({ error: "Live stream is switched off for this round." }, { status: 409 })

  const length = Number(req.headers.get("content-length") ?? "0")
  if (length > MAX_LIVE_SEGMENT_BYTES) return NextResponse.json({ error: "Segment too large." }, { status: 413 })
  const body = await req.arrayBuffer()
  if (body.byteLength === 0) return NextResponse.json({ error: "Empty segment." }, { status: 400 })
  if (body.byteLength > MAX_LIVE_SEGMENT_BYTES) return NextResponse.json({ error: "Segment too large." }, { status: 413 })

  const durationMs = Math.min(Math.max(Number.parseInt(params.get("durationMs") ?? "0", 10) || 0, 0), 60_000)
  const result = await appendSegment(db, bucket, row, {
    body,
    contentType,
    speech: cleanSpeechName(params.get("speech")),
    durationMs,
    userId: who.userId,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ seq: result.seq }, { status: 201 })
})
