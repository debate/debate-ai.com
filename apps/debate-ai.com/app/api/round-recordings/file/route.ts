import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth/session"
import { getRoundRecordingsBucket, isOwnRoundFileKey } from "@/lib/round-recordings/storage"

/**
 * GET ?key=round-recordings/<userId>/<roundId>/<file> — streams one of the
 * signed-in user's own round files back. The bucket is private; this is the
 * only way in.
 */
export async function GET(request: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "Sign in to open round recordings." }, { status: 401 })
  const bucket = getRoundRecordingsBucket()
  if (!bucket) return NextResponse.json({ error: "Recording storage is not configured" }, { status: 503 })

  const key = new URL(request.url).searchParams.get("key") ?? ""
  if (!isOwnRoundFileKey(key, userId)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const object = await bucket.get(key)
  if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Length": String(object.size),
      "Cache-Control": "private, no-store",
    },
  })
}
