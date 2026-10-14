import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth/session"
import {
  MAX_UPLOAD_BYTES,
  getRoundRecordingsBucket,
  isAllowedContentType,
  isRoundId,
  roundFileKey,
  roundFolder,
} from "@/lib/round-recordings/storage"

/**
 * A round's joined recording in R2 (`lib/round-recordings/storage.ts`), for
 * the signed-in user who recorded it.
 *
 * PUT ?roundId=…&name=round.mp3 — body is the file; returns `{ key }`.
 *   Called only from the "Save to cloud" button of the round recording
 *   dialog; the recorder never uploads on its own.
 * GET ?roundId=… — the user's files for that round: `{ files: [{ key, name, size, uploaded }] }`.
 */
async function resolve(request: Request) {
  const userId = await getUserId()
  if (!userId) return { error: NextResponse.json({ error: "Sign in to save round recordings." }, { status: 401 }) }
  const bucket = getRoundRecordingsBucket()
  if (!bucket) {
    return {
      error: NextResponse.json(
        { error: "Recording storage is not configured", details: "Bind an R2 bucket as ROUND_RECORDINGS in wrangler.jsonc." },
        { status: 503 },
      ),
    }
  }
  const params = new URL(request.url).searchParams
  return { userId, bucket, roundId: params.get("roundId") ?? "", name: params.get("name") ?? "" }
}

export async function PUT(request: Request) {
  const resolved = await resolve(request)
  if ("error" in resolved) return resolved.error
  const { userId, bucket, roundId, name } = resolved

  const key = roundFileKey(userId, roundId, name)
  if (!key) return NextResponse.json({ error: "Invalid round id or file name." }, { status: 400 })
  const contentType = request.headers.get("content-type")
  if (!isAllowedContentType(contentType)) {
    return NextResponse.json({ error: "Only audio, video, captions and JSON files can be saved." }, { status: 415 })
  }
  const length = Number(request.headers.get("content-length") ?? "0")
  if (length > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File too large." }, { status: 413 })
  if (!request.body) return NextResponse.json({ error: "Empty body." }, { status: 400 })

  // Buffered rather than streamed: R2's put needs a known length, and a
  // chunked browser upload doesn't always send Content-Length.
  const body = await request.arrayBuffer()
  if (body.byteLength === 0) return NextResponse.json({ error: "Empty body." }, { status: 400 })
  if (body.byteLength > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File too large." }, { status: 413 })
  await bucket.put(key, body, { httpMetadata: { contentType: contentType ?? undefined } })
  return NextResponse.json({ key })
}

export async function GET(request: Request) {
  const resolved = await resolve(request)
  if ("error" in resolved) return resolved.error
  const { userId, bucket, roundId } = resolved
  if (!isRoundId(roundId)) return NextResponse.json({ error: "Invalid round id." }, { status: 400 })

  const prefix = roundFolder(userId, roundId)
  const files: Array<{ key: string; name: string; size: number; uploaded: string }> = []
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix, cursor })
    for (const object of page.objects) {
      files.push({ key: object.key, name: object.key.slice(prefix.length), size: object.size, uploaded: object.uploaded.toISOString() })
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return NextResponse.json({ files })
}
