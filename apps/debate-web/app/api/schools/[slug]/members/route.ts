import { NextRequest, NextResponse } from "next/server"
import { parseMemberBody } from "@debate-ai/webview/lib/schools/school-claims"
import { isProfileSlug } from "@debate-ai/rankings-adapter/src/leaderboard/follows/profile-follows"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getDBFromContext } from "@/lib/database/context"
import { SchoolClaimError, addSchoolMember, getSchoolPage, removeSchoolMember } from "@/lib/school-claims/queries"
import { schoolManager } from "@/lib/school-claims/access"

/**
 * A school's roster: the teams and students its owners list as part of it.
 *
 * POST `{ kind: "team" | "student", name, email? }` — adds one.
 * DELETE `?id=` — removes one.
 * Both are for the school's owners (and staff), and answer with the page data.
 */

type Context = { params: Promise<{ slug: string }> }

async function managed(slug: string) {
  if (!isProfileSlug(slug)) return { ok: false as const, error: NextResponse.json({ error: "Not a school URL segment." }, { status: 400 }) }
  const viewer = await schoolManager(slug)
  if (!viewer.canManage || !viewer.userId) {
    return { ok: false as const, error: NextResponse.json({ error: "Only the school's owners can change its roster." }, { status: 403 }) }
  }
  return { ok: true as const, viewer: { ...viewer, userId: viewer.userId } }
}

export const POST = withRouteErrors("POST /api/schools/[slug]/members", async (req: NextRequest, { params }: Context) => {
  const { slug } = await params
  const access = await managed(slug)
  if (!access.ok) return access.error
  const parsed = parseMemberBody(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const db = await getDBFromContext()
  try {
    await addSchoolMember(db, { slug, kind: parsed.kind, name: parsed.name, email: parsed.email, addedBy: access.viewer.userId })
  } catch (error) {
    if (error instanceof SchoolClaimError) return NextResponse.json({ error: error.message }, { status: error.status })
    throw error
  }
  return NextResponse.json(await getSchoolPage(db, slug, access.viewer))
})

export const DELETE = withRouteErrors("DELETE /api/schools/[slug]/members", async (req: NextRequest, { params }: Context) => {
  const { slug } = await params
  const access = await managed(slug)
  if (!access.ok) return access.error
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Provide ?id=" }, { status: 400 })
  const db = await getDBFromContext()
  await removeSchoolMember(db, slug, id)
  return NextResponse.json(await getSchoolPage(db, slug, access.viewer))
})
