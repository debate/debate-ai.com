/**
 * @fileoverview The active organization, as the contacts and card-share
 * routes see it.
 *
 * better-auth's organization plugin keeps the organization a session works in
 * on `session.activeOrganizationId` (switched from the sidebar's account
 * menu). While one is set, `/api/contacts` lists its members and
 * `/api/card-shares` lists only shares with them; with none set, both answer
 * for the personal workspace exactly as before. The id is only trusted once
 * the caller is confirmed to be a member, so a stale or forged id falls back
 * to the personal workspace rather than exposing another group's members.
 */
import { and, eq } from "drizzle-orm"
import type { DB } from "@/lib/contacts/server"
import { describeError } from "@/lib/database/errors"
import { member, organization } from "@/lib/database/schema"

export interface ActiveOrganization {
  id: string
  name: string
  /** The caller's role in it (`owner`, `admin` or `member`). */
  role: string
  /** Every member's user id, the caller's included. */
  memberIds: Set<string>
}

/**
 * The caller's active organization with its member ids, or null for the
 * personal workspace (no id set, the caller is not a member, or the tables
 * are not there yet).
 */
export async function loadActiveOrganization(
  db: DB,
  userId: string,
  activeOrganizationId: string | null | undefined,
): Promise<ActiveOrganization | null> {
  if (!activeOrganizationId) return null
  try {
    const [mine] = await db
      .select({ name: organization.name, role: member.role })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(and(eq(member.organizationId, activeOrganizationId), eq(member.userId, userId)))
      .limit(1)
    if (!mine) return null
    const rows = await db
      .select({ userId: member.userId })
      .from(member)
      .where(eq(member.organizationId, activeOrganizationId))
    return {
      id: activeOrganizationId,
      name: mine.name,
      role: mine.role,
      memberIds: new Set(rows.map((row: { userId: string }) => row.userId)),
    }
  } catch (error) {
    // Drizzle wraps the driver error, so the cause chain carries the reason.
    if (/no such table/i.test(describeError(error))) return null
    throw error
  }
}

/** Whether a role may add members to an organization. */
export function canManageMembers(role: string): boolean {
  return role.split(",").some((r) => r.trim() === "owner" || r.trim() === "admin")
}
