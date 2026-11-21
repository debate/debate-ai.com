/**
 * Settings → Privacy's data deletion requests and the recording release
 * lookup publishers use.
 *
 * `data_deletion_requests` is created here on first use: the app has no
 * tracked migrations (see `lib/database/ensure-columns.ts`), and this table
 * is new, so `CREATE TABLE IF NOT EXISTS` mirrors its `schema.ts` definition.
 */

import { desc, eq, inArray, sql } from "drizzle-orm";
import {
  DELETION_CATEGORIES,
  parseRecordingPrivacy,
  type DeletionRequestInput,
  type DeletionStatus,
  type DeletionStatusUpdate,
  type RecordingPrivacy,
} from "@debate-ai/webview/lib/privacy/recording-release";
import type { getDBFromContext } from "@/lib/database/context";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { dataDeletionRequests, notifications, user, userSettings } from "@/lib/database/schema";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "data_deletion_requests" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "scope" text NOT NULL,
  "categories" text DEFAULT '[]' NOT NULL,
  "details" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL
)`;

let tableReady: Promise<void> | null = null;

function ensureTable(db: Database): Promise<void> {
  tableReady ??= Promise.resolve(db.run(sql.raw(CREATE_TABLE_SQL))).then(
    () => undefined,
    (error) => {
      tableReady = null;
      throw error;
    },
  );
  return tableReady;
}

/** A stored request, as the settings tab lists it. */
export interface DeletionRequestRow {
  id: number;
  scope: string;
  categories: string[];
  details: string;
  status: string;
  createdAt: string;
}

function parseCategories(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

/** The user's own requests, newest first. */
export async function listDeletionRequests(db: Database, userId: string): Promise<DeletionRequestRow[]> {
  await ensureTable(db);
  const rows = await db
    .select()
    .from(dataDeletionRequests)
    .where(eq(dataDeletionRequests.userId, userId))
    .orderBy(desc(dataDeletionRequests.createdAt), desc(dataDeletionRequests.id))
    .limit(50);
  return rows.map((row: typeof dataDeletionRequests.$inferSelect) => ({
    id: row.id,
    scope: row.scope,
    categories: parseCategories(row.categories),
    details: row.details,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Files a request and returns it. */
export async function createDeletionRequest(
  db: Database,
  userId: string,
  input: DeletionRequestInput,
): Promise<DeletionRequestRow> {
  await ensureTable(db);
  const createdAt = new Date();
  const [row] = await db
    .insert(dataDeletionRequests)
    .values({
      userId,
      scope: input.scope,
      categories: JSON.stringify(input.categories),
      details: input.details,
      status: "pending",
      createdAt,
    })
    .returning();
  return {
    id: row.id,
    scope: row.scope,
    categories: input.categories,
    details: row.details,
    status: row.status,
    createdAt: createdAt.toISOString(),
  };
}

/**
 * Pings every env-listed admin that a deletion request is waiting. Never
 * throws: a failed notification must not fail the user's request.
 */
export async function notifyAdminsOfDeletionRequest(
  db: Database,
  adminEmails: string[],
  request: DeletionRequestRow,
): Promise<number> {
  try {
    if (adminEmails.length === 0) return 0;
    const recipients = await db.select({ id: user.id }).from(user).where(inArray(user.email, adminEmails));
    if (recipients.length === 0) return 0;
    const what = request.scope === "all" ? "all of their data" : request.categories.join(", ") || "part of their data";
    await db.insert(notifications).values(
      recipients.map((recipient: { id: string }) => ({
        userId: recipient.id,
        type: "data_deletion_request",
        title: "Data deletion request",
        body: `A user asked to delete ${what}.${request.details ? ` Notes: ${request.details.slice(0, 300)}` : ""}`,
        link: "/admin#deletion-requests",
        createdAt: new Date(),
      })),
    );
    return recipients.length;
  } catch (error) {
    console.error("Failed to notify admins of a data deletion request:", error);
    return 0;
  }
}

/** A request as the admin queue lists it: the row plus who filed it. */
export interface AdminDeletionRequestRow extends DeletionRequestRow {
  userId: string;
  name: string | null;
  email: string | null;
}

/** Most requests the admin queue loads at once. */
export const ADMIN_DELETION_REQUEST_LIMIT = 200;

/**
 * Every user's requests for the admin queue: pending ones first (oldest
 * first, so the longest-waiting is on top), then worked ones newest first.
 * `status` narrows the list to one status.
 */
export async function listAllDeletionRequests(
  db: Database,
  options: { status?: DeletionStatus } = {},
): Promise<AdminDeletionRequestRow[]> {
  await ensureTable(db);
  const query = db
    .select({
      id: dataDeletionRequests.id,
      userId: dataDeletionRequests.userId,
      scope: dataDeletionRequests.scope,
      categories: dataDeletionRequests.categories,
      details: dataDeletionRequests.details,
      status: dataDeletionRequests.status,
      createdAt: dataDeletionRequests.createdAt,
      name: user.name,
      email: user.email,
    })
    .from(dataDeletionRequests)
    .leftJoin(user, eq(user.id, dataDeletionRequests.userId));
  const rows = await (options.status ? query.where(eq(dataDeletionRequests.status, options.status)) : query)
    .orderBy(
      sql`CASE WHEN ${dataDeletionRequests.status} = 'pending' THEN 0 ELSE 1 END`,
      sql`CASE WHEN ${dataDeletionRequests.status} = 'pending' THEN ${dataDeletionRequests.createdAt} ELSE -${dataDeletionRequests.createdAt} END`,
      desc(dataDeletionRequests.id),
    )
    .limit(ADMIN_DELETION_REQUEST_LIMIT);
  return rows.map(
    (row: {
      id: number;
      userId: string;
      scope: string;
      categories: string;
      details: string;
      status: string;
      createdAt: Date;
      name: string | null;
      email: string | null;
    }) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      email: row.email,
      scope: row.scope,
      categories: parseCategories(row.categories),
      details: row.details,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }),
  );
}

const STATUS_WORDS: Record<DeletionStatus, string> = {
  pending: "reopened",
  done: "completed",
  declined: "declined",
};

/** The requester's notification text for a status change. */
export function deletionStatusNotice(
  request: Pick<DeletionRequestRow, "scope" | "categories">,
  status: DeletionStatus,
  note: string,
): { title: string; body: string } {
  const labels = request.categories.map((id) => DELETION_CATEGORIES.find((c) => c.id === id)?.label ?? id);
  const what = request.scope === "all" ? "all of your data" : labels.join(", ").toLowerCase() || "part of your data";
  return {
    title: `Deletion request ${STATUS_WORDS[status]}`,
    body: `Your request to delete ${what} was ${STATUS_WORDS[status]}.${note ? ` ${note.slice(0, 500)}` : ""}`,
  };
}

/**
 * Sets one request's status. Returns the updated row, or `null` when no
 * request has that id. When the status actually changes, the requester gets
 * a notification (with the admin's note); a failed notification never fails
 * the update. This only records the admin's decision — it deletes nothing.
 */
export async function updateDeletionRequestStatus(
  db: Database,
  update: DeletionStatusUpdate,
): Promise<DeletionRequestRow | null> {
  await ensureTable(db);
  const [current] = await db
    .select()
    .from(dataDeletionRequests)
    .where(eq(dataDeletionRequests.id, update.id))
    .limit(1);
  if (!current) return null;
  const row: DeletionRequestRow = {
    id: current.id,
    scope: current.scope,
    categories: parseCategories(current.categories),
    details: current.details,
    status: update.status,
    createdAt: current.createdAt.toISOString(),
  };
  if (current.status === update.status) return row;
  await db.update(dataDeletionRequests).set({ status: update.status }).where(eq(dataDeletionRequests.id, update.id));
  try {
    const notice = deletionStatusNotice(row, update.status, update.note);
    await db.insert(notifications).values({
      userId: current.userId,
      type: "data_deletion_request_status",
      title: notice.title,
      body: notice.body,
      link: "/settings?category=privacy",
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to notify a user of their deletion request status:", error);
  }
  return row;
}

/** Reads a user's stored recording release (the defaults when unset). */
export async function getRecordingPrivacy(db: Database, userId: string): Promise<RecordingPrivacy> {
  await ensureTableColumns(db, userSettings);
  const [row] = await db
    .select({ recordingPrivacy: userSettings.recordingPrivacy })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return parseRecordingPrivacy(row?.recordingPrivacy ?? null);
}

/** Stores a user's recording release. */
export async function saveRecordingPrivacy(db: Database, userId: string, value: RecordingPrivacy): Promise<void> {
  await ensureTableColumns(db, userSettings);
  const json = JSON.stringify(value);
  const now = new Date();
  await db
    .insert(userSettings)
    .values({ userId, recordingPrivacy: json })
    .onConflictDoUpdate({ target: userSettings.userId, set: { recordingPrivacy: json, updatedAt: now } });
}
