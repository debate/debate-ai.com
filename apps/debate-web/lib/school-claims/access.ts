/**
 * @fileoverview Who may manage a school page: its owners (users with an
 * approved claim on it) and staff (admins and moderators).
 *
 * @module lib/school-claims/access
 */

import { getStaffAccess } from "@/lib/auth/admin"
import { getSession } from "@/lib/auth/session"
import { getDBFromContext } from "@/lib/database/context"
import { isSchoolOwner } from "./queries"

/** The viewer's id, whether they are staff, and whether they may manage `slug`. */
export async function schoolManager(slug: string) {
  const session = await getSession()
  const userId = session?.user?.id ?? null
  const { canEditContent } = await getStaffAccess()
  const isOwner = userId ? await isSchoolOwner(await getDBFromContext(), userId, slug) : false
  return { userId, isStaff: canEditContent, canManage: isOwner || canEditContent }
}
