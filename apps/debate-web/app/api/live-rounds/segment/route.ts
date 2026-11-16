import { NextRequest, NextResponse } from "next/server"
import { isLiveStreamId } from "@debate-ai/timer/src/recorder/live-radio"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getSession } from "@/lib/auth/session"
import { getDBFromContext } from "@/lib/database/context"
import { getRoundRecordingsBucket } from "@/lib/round-recordings/storage"
import { canListen, getLiveRound, getSegment } from "@/lib/live-rounds/store"

/**
 * GET ?id=…&seq=N — streams one segment of a live round (`/api/live-rounds`).
 * Segments never change once stored, so a public stream's are cached for a
 * year; a private stream's only reach its owner and invitees, uncached.
 */
export const GET = withRouteErrors("GET /api/live-rounds/segment", async (req: NextRequest) => {
  const params = new URL(req.url).searchParams
  const id = params.get("id") ?? ""
  const seq = Number.parseInt(params.get("seq") ?? "", 10)
  if (!isLiveStreamId(id) || !Number.isInteger(seq) || seq < 0) {
    return NextResponse.json({ error: "Give ?id= and ?seq=." }, { status: 400 })
  }
  const bucket = getRoundRecordingsBucket()
  if (!bucket) return NextResponse.json({ error: "Recording storage is not configured" }, { status: 503 })

  const db = await getDBFromContext()
  const row = await getLiveRound(db, id)
  const isPrivate = !!row && !!Number(row.is_private)
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (isPrivate) {
    const session = await getSession()
    const who = session ? { userId: session.user.id, email: session.user.email ?? "" } : null
    if (!canListen(row, who)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const segment = await getSegment(db, id, seq)
  if (!segment) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const object = await bucket.get(segment.r2_key)
  if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? segment.content_type,
      "Content-Length": String(object.size),
      "Cache-Control": isPrivate ? "private, no-store" : "public, max-age=31536000, immutable",
    },
  })
})
