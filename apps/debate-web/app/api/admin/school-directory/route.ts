import { NextResponse } from "next/server"
import { getStaffAccess } from "@/lib/auth/admin"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getDBFromContext } from "@/lib/database/context"
import { getSchoolDirectoryReport, rebuildSchoolDirectory } from "@/lib/rankings/school-directory-store"

/**
 * The admin "Schools with missing info" section — admins and moderators.
 *
 * GET — the school directory's report: schools of the last ten seasons whose
 * pages are missing a name or a logo, and names that look like one school
 * split over two pages.
 * POST — rebuilds the directory now (the daily cron otherwise does), then
 * returns the report.
 */

export const GET = withRouteErrors("GET /api/admin/school-directory", async () => {
  const { canEditContent } = await getStaffAccess()
  if (!canEditContent) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return NextResponse.json(await getSchoolDirectoryReport(await getDBFromContext()))
})

export const POST = withRouteErrors("POST /api/admin/school-directory", async () => {
  const { canEditContent } = await getStaffAccess()
  if (!canEditContent) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const db = await getDBFromContext()
  await rebuildSchoolDirectory(db)
  return NextResponse.json(await getSchoolDirectoryReport(db))
})
