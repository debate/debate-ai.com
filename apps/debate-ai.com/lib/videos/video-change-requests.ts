/**
 * Viewer change requests for a published video — "edit these fields" or
 * "delete this video" — filed by anyone signed in from the watch page's edit
 * button and applied only once a moderator approves them.
 *
 * They ride the existing `video_issues` queue rather than a table of their
 * own: a request is a report whose `kind` is `edit` or `delete`, and an edit's
 * proposed fields are stored as JSON in the report's `issue` text. That keeps
 * them in the moderators' one "Reports" list and needs no migration.
 */

import { inArray } from "drizzle-orm";
import { isLectureCategory } from "@debate/data-sync/src/youtube/parsers/lecture-classifier";
import { notifications, staffRoles, user } from "@/lib/database/schema";
import type { getDBFromContext } from "@/lib/database/context";
import type { LibraryVideoPatch } from "./admin-library";

/**
 * Fields a viewer may propose a new value for. View counts, the source and
 * the top-pick flag are editorial or synced, so they are staff-only.
 */
export const SUGGESTABLE_FIELDS = [
  "title",
  "channel",
  "publishedAt",
  "description",
  "style",
  "category",
  "tournament",
  "roundLevel",
  "affTeam",
  "negTeam",
  "affWin",
  "judgeDecision",
  "speechDocsUrl",
] as const;

/** Longest stored edit request, serialized. A description can be long. */
export const MAX_CHANGE_REQUEST_LENGTH = 12000;

/** Longest single proposed text value. */
const MAX_FIELD_LENGTH = 5000;

/** Numeric debate styles, matching `videos.style`. */
const STYLES = [1, 2, 3, 4];

/**
 * Keeps only the fields a viewer may change, coerced to the shapes the
 * library PATCH accepts. Unknown fields, out-of-range styles and categories
 * outside the classifier's list are dropped rather than rejected, so one bad
 * field never loses the rest of a request.
 *
 * @param input - The `proposedChanges` object from the request body.
 * @returns The sanitized patch; empty when nothing usable was proposed.
 */
export function sanitizeProposedChanges(input: unknown): LibraryVideoPatch {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const raw = input as Record<string, unknown>;
  const patch: LibraryVideoPatch = {};

  for (const field of SUGGESTABLE_FIELDS) {
    if (!Object.hasOwn(raw, field)) continue;
    const value = raw[field];

    if (field === "style") {
      if (value === null) patch.style = null;
      else if (STYLES.includes(Number(value))) patch.style = Number(value);
      continue;
    }
    if (field === "affWin") {
      if (value === null || typeof value === "boolean") patch.affWin = value;
      continue;
    }
    if (field === "category") {
      if (value === null || value === "") patch.category = null;
      else if (isLectureCategory(value)) patch.category = value;
      continue;
    }
    if (value === null) {
      patch[field] = null;
    } else if (typeof value === "string") {
      patch[field] = value.slice(0, MAX_FIELD_LENGTH);
    }
  }

  return patch;
}

/**
 * Parses an edit request's stored `issue` text back into its patch.
 *
 * @returns The patch, or `null` when the text is not an edit request.
 */
export function parseStoredChanges(issue: string): LibraryVideoPatch | null {
  try {
    const parsed = JSON.parse(issue) as { changes?: unknown };
    const changes = sanitizeProposedChanges(parsed?.changes);
    return Object.keys(changes).length > 0 ? changes : null;
  } catch {
    return null;
  }
}

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

/**
 * Drops an in-app notification on every admin and moderator who has an
 * account, pointing at the admin panel's review queue. Best-effort: a failed
 * notification never fails the request it announces.
 *
 * @param db - The request's database handle.
 * @param adminEmails - The env admin allowlist.
 * @param message - The notification's title and body.
 */
export async function notifyVideoModerators(
  db: Database,
  adminEmails: string[],
  message: { title: string; body: string },
): Promise<number> {
  try {
    const moderators = await db.select({ email: staffRoles.email }).from(staffRoles);
    const emails = [...new Set([...adminEmails, ...moderators.map((row: { email: string }) => row.email.toLowerCase())])];
    if (emails.length === 0) return 0;

    const recipients = await db.select({ id: user.id }).from(user).where(inArray(user.email, emails));
    if (recipients.length === 0) return 0;

    const createdAt = new Date();
    await db.insert(notifications).values(
      recipients.map((recipient: { id: string }) => ({
        userId: recipient.id,
        type: "video_change_request",
        title: message.title,
        body: message.body,
        link: "/admin",
        createdAt,
      })),
    );
    return recipients.length;
  } catch (error) {
    console.error("Failed to notify moderators of a video change request:", error);
    return 0;
  }
}
