import { NextRequest, NextResponse } from "next/server"
import { isLogoDataUrl, MAX_LOGO_DATA_URL_LENGTH } from "@debate-ai/rankings/src/schools/school-claims"
import { isProfileSlug } from "@debate-ai/rankings/src/leaderboard/follows/profile-follows"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getDBFromContext } from "@/lib/database/context"
import { getSchoolPage, setSchoolLogo } from "@/lib/school-claims/queries"
import { schoolManager } from "@/lib/school-claims/access"

/**
 * One school page's owner-managed data (`/schools/[school]`).
 *
 * GET — the logo, the owners, and the roster of teams and students; readable
 * signed out. `canManage` says whether the viewer may edit them.
 * PATCH `{ logo }` — an owner (or staff) sets the logo to an image data URL,
 * or deletes it with `null`.
 */

type Context = { params: Promise<{ slug: string }> }

export const GET = withRouteErrors("GET /api/schools/[slug]", async (_req: NextRequest, { params }: Context) => {
  const { slug } = await params
  if (!isProfileSlug(slug)) return NextResponse.json({ error: "Not a school URL segment." }, { status: 400 })
  const viewer = await schoolManager(slug)
  return NextResponse.json(await getSchoolPage(await getDBFromContext(), slug, viewer))
})

export const PATCH = withRouteErrors("PATCH /api/schools/[slug]", async (req: NextRequest, { params }: Context) => {
  const { slug } = await params
  if (!isProfileSlug(slug)) return NextResponse.json({ error: "Not a school URL segment." }, { status: 400 })
  const viewer = await schoolManager(slug)
  if (!viewer.canManage) return NextResponse.json({ error: "Only the school's owners can change its page." }, { status: 403 })

  const body = (await req.json().catch(() => null)) as { logo?: unknown } | null
  if (!body || !("logo" in body)) return NextResponse.json({ error: "Provide { logo }." }, { status: 400 })
  if (body.logo !== null && !isLogoDataUrl(body.logo)) {
    return NextResponse.json(
      { error: `The logo must be a PNG, JPEG, WebP or GIF under ${Math.floor((MAX_LOGO_DATA_URL_LENGTH * 3) / 4 / 1000)} KB.` },
      { status: 400 },
    )
  }
  const db = await getDBFromContext()
  await setSchoolLogo(db, slug, body.logo)
  return NextResponse.json(await getSchoolPage(db, slug, viewer))
})
