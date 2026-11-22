import { NextRequest, NextResponse } from "next/server"
import { isLogoDataUrl, MAX_LOGO_DATA_URL_LENGTH } from "@debate-ai/rankings/src/schools/school-claims"
import { isProfileSlug } from "@debate-ai/rankings/src/leaderboard/follows/profile-follows"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getDBFromContext } from "@/lib/database/context"
import { getSchoolPage, setSchoolLocation, setSchoolLogo, storedSchoolSlug } from "@/lib/school-claims/queries"
import { MAX_SCHOOL_CITY_LENGTH, normalizeStateCode } from "@debate-ai/rankings/src/schools/school-location"
import { schoolManager } from "@/lib/school-claims/access"

/**
 * One school page's owner-managed data (`/schools/[school]`).
 *
 * GET — the logo, the owners, and the roster of teams and students; readable
 * signed out. `canManage` says whether the viewer may edit them.
 * PATCH `{ logo }` — an owner (or staff) sets the logo to an image data URL,
 * or deletes it with `null`. PATCH `{ city, state }` sets where the school is
 * (shown under its name); `null` or `""` clears either.
 */

type Context = { params: Promise<{ slug: string }> }

export const GET = withRouteErrors("GET /api/schools/[slug]", async (_req: NextRequest, { params }: Context) => {
  const { slug: requested } = await params
  if (!isProfileSlug(requested)) return NextResponse.json({ error: "Not a school URL segment." }, { status: 400 })
  const slug = await storedSchoolSlug(await getDBFromContext(), requested)
  const viewer = await schoolManager(slug)
  return NextResponse.json(await getSchoolPage(await getDBFromContext(), slug, viewer))
})

export const PATCH = withRouteErrors("PATCH /api/schools/[slug]", async (req: NextRequest, { params }: Context) => {
  const { slug: requested } = await params
  if (!isProfileSlug(requested)) return NextResponse.json({ error: "Not a school URL segment." }, { status: 400 })
  const slug = await storedSchoolSlug(await getDBFromContext(), requested)
  const viewer = await schoolManager(slug)
  if (!viewer.canManage) return NextResponse.json({ error: "Only the school's owners can change its page." }, { status: 403 })

  const body = (await req.json().catch(() => null)) as { logo?: unknown; city?: unknown; state?: unknown } | null
  if (body && !("logo" in body) && ("city" in body || "state" in body)) {
    const city = typeof body.city === "string" ? body.city.trim().slice(0, MAX_SCHOOL_CITY_LENGTH) || null : null
    const blankState = body.state === null || body.state === undefined || body.state === ""
    const state = normalizeStateCode(body.state)
    if (!blankState && !state) return NextResponse.json({ error: "State must be a two-letter US state code." }, { status: 400 })
    const db = await getDBFromContext()
    await setSchoolLocation(db, slug, { city, state })
    return NextResponse.json(await getSchoolPage(db, slug, viewer))
  }
  if (!body || !("logo" in body)) return NextResponse.json({ error: "Provide { logo } or { city, state }." }, { status: 400 })
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
