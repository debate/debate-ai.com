import { eq } from "drizzle-orm";
import { getEnv } from "../env";
import { getDBFromContext } from "../database/context";
import { staffRoles } from "../database/schema";
import { getSession } from "./session";

/** Splits a comma/whitespace-separated email list into normalized addresses. */
export function parseEmailList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The admin allowlist, merged from ADMIN_EMAILS (comma-separated) and
 * ADMIN_EMAIL (a single address, or also a list). Only these addresses can
 * open `/admin` with full rights — an unset list means nobody is an admin.
 */
export function getAdminEmails(): string[] {
  return [
    ...new Set([...parseEmailList(getEnv("ADMIN_EMAILS")), ...parseEmailList(getEnv("ADMIN_EMAIL"))]),
  ];
}

/** Whether `email` is on the env admin allowlist. */
export function isAdminEmail(email: string | null | undefined, adminEmails = getAdminEmails()): boolean {
  return !!email && adminEmails.includes(email.toLowerCase());
}

export interface AdminAccess {
  isAdmin: boolean;
  email: string | null;
}

/** Full admin rights: users, sync jobs, uploads and moderator management. */
export async function getAdminAccess(): Promise<AdminAccess> {
  const session = await getSession();
  const email = session?.user?.email?.toLowerCase() ?? null;
  return { isAdmin: isAdminEmail(email), email };
}

export type StaffRole = "admin" | "moderator";

/** Roles that can be granted from the admin panel (admins come from env only). */
export const INVITABLE_ROLES = ["moderator"] as const;

export interface StaffAccess extends AdminAccess {
  role: StaffRole | null;
  isModerator: boolean;
  /** Admins and moderators — may edit videos and debate rounds. */
  canEditContent: boolean;
}

/** Looks up a moderator grant for `email`; a missing table reads as "no grant". */
export async function getModeratorRole(email: string): Promise<StaffRole | null> {
  try {
    const db = await getDBFromContext();
    const [row] = await db
      .select({ role: staffRoles.role })
      .from(staffRoles)
      .where(eq(staffRoles.email, email.toLowerCase()))
      .limit(1);
    return row?.role === "moderator" ? "moderator" : null;
  } catch (error) {
    console.error("Failed to read staff roles:", error);
    return null;
  }
}

/**
 * Admin-or-moderator access, for routes and UI that edit content (the video
 * library, video reports and the round-video queue).
 */
export async function getStaffAccess(): Promise<StaffAccess> {
  const { isAdmin, email } = await getAdminAccess();
  const role: StaffRole | null = isAdmin ? "admin" : email ? await getModeratorRole(email) : null;
  const isModerator = role === "moderator";
  return { isAdmin, email, role, isModerator, canEditContent: isAdmin || isModerator };
}
