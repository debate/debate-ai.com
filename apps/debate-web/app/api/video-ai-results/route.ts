import { NextRequest, NextResponse } from "next/server"
import {
  EMPTY_SHARED_VIDEO_AI,
  SHARED_VIDEO_AI_KINDS,
  isSharedVideoId,
  parseSharedVideoAiWrite,
  type SharedVideoAiKind,
} from "@debate-ai/videos/src/lib/shared-video-ai"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getStaffAccess } from "@/lib/auth/admin"
import { getUserId } from "@/lib/auth/session"
import { isMissingTableError } from "@/lib/contacts/server"
import { getDBFromContext } from "@/lib/database/context"
import { deleteSharedVideoAi, loadSharedVideoAi, saveSharedVideoAi } from "@/lib/video-ai-results/queries"

/**
 * The watch page's AI results, shared by every viewer of a YouTube video:
 * "Detect speeches", each speech's LLM summary and each Outcomes run. The
 * answer depends on the video, not on who asked, so the first good one is
 * saved and served to everyone and a video is analyzed once.
 *
 * GET ?videoId= — `{ segmentation, summaries, outcomes }`. Public, signed out
 * included.
 *
 * POST `{ videoId, kind, key, data, replace? }` — offers a result the caller
 * just generated (signed in; the AI proxy that made it requires a session
 * anyway). `data` is re-parsed the way the model's reply was. The first
 * result per key wins; a later one is answered `{ stored: false, item }` with
 * the stored copy. `replace: true` overwrites only for admins and moderators.
 *
 * DELETE ?videoId=&kind=&key= — staff only; without `kind`, clears the video.
 */

export const GET = withRouteErrors("GET /api/video-ai-results", async (req: NextRequest) => {
  const videoId = new URL(req.url).searchParams.get("videoId") ?? ""
  if (!isSharedVideoId(videoId)) return NextResponse.json({ error: "Give ?videoId= a YouTube id." }, { status: 400 })
  let shared = EMPTY_SHARED_VIDEO_AI
  try {
    shared = await loadSharedVideoAi(await getDBFromContext(), videoId)
  } catch (error) {
    // Before the migration lands, nothing is shared yet.
    if (!isMissingTableError(error)) throw error
  }
  // Short, so a result someone just ran reaches the next viewer soon.
  return NextResponse.json(shared, { headers: { "cache-control": "public, max-age=60" } })
})

export const POST = withRouteErrors("POST /api/video-ai-results", async (req: NextRequest) => {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "Sign in to share AI results." }, { status: 401 })
  const parsed = parseSharedVideoAiWrite(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const canReplace = parsed.value.replace ? (await getStaffAccess()).canEditContent : false
  const saved = await saveSharedVideoAi(await getDBFromContext(), parsed.value, { userId, canReplace })
  if (!saved) return NextResponse.json({ error: "This video already holds as many AI results as it can." }, { status: 409 })
  return NextResponse.json(saved)
})

export const DELETE = withRouteErrors("DELETE /api/video-ai-results", async (req: NextRequest) => {
  if (!(await getStaffAccess()).canEditContent) {
    return NextResponse.json({ error: "Only admins and moderators can clear shared AI results." }, { status: 403 })
  }
  const params = new URL(req.url).searchParams
  const videoId = params.get("videoId") ?? ""
  if (!isSharedVideoId(videoId)) return NextResponse.json({ error: "Give ?videoId= a YouTube id." }, { status: 400 })
  const kind = params.get("kind")
  if (kind !== null && !SHARED_VIDEO_AI_KINDS.includes(kind as SharedVideoAiKind)) {
    return NextResponse.json({ error: "`kind` must be segmentation, summary or outcome." }, { status: 400 })
  }
  await deleteSharedVideoAi(
    await getDBFromContext(),
    videoId,
    kind ? { kind: kind as SharedVideoAiKind, key: params.get("key") ?? "" } : undefined,
  )
  return NextResponse.json({ ok: true })
})
