import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import { FollowLimitError, getFollowState, listFollows, setFollow } from "@/lib/profile-follows/queries"
import { isFollowKind, isProfileSlug, parseFollowBody } from "@debate/videos/src/lib/follows/profile-follows"

/**
 * Following team and school profiles (`/@[team]` handles,
 * `/schools/[school]`).
 *
 * GET `?kind=team|school&slug=` — that profile's follower count, readable
 * signed out; a signed-in reader also learns whether they follow it.
 *
 * GET with no params — every profile the signed-in user follows, newest
 * first (an empty list when signed out). The news feed reads this.
 *
 * PUT `{ kind, slug, name, follow }` — follows (`follow: true`) or unfollows
 * a profile for the signed-in user; answers with its new state.
 */

export const GET = withRouteErrors("GET /api/follows", async (req: NextRequest) => {
  const kind = req.nextUrl.searchParams.get("kind")
  const slug = req.nextUrl.searchParams.get("slug")
  const userId = await getUserId()
  const db = await getDBFromContext()

  if (kind === null && slug === null) {
    return NextResponse.json({ follows: userId ? await listFollows(db, userId) : [], signedIn: userId !== null })
  }
  if (!isFollowKind(kind) || !isProfileSlug(slug)) {
    return NextResponse.json({ error: 'kind must be "team" or "school" and slug a profile URL segment.' }, { status: 400 })
  }
  return NextResponse.json(await getFollowState(db, { kind, slug }, userId))
})

export const PUT = withRouteErrors("PUT /api/follows", async (req: NextRequest) => {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to follow." }, { status: 401 })
  }
  const parsed = parseFollowBody(await req.json().catch(() => null))
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const db = await getDBFromContext()
  try {
    return NextResponse.json(await setFollow(db, { userId, ...parsed }))
  } catch (error) {
    if (error instanceof FollowLimitError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    throw error
  }
})
