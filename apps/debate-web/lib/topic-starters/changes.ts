/**
 * @fileoverview Applies and queues edits to the public Topic Starters
 * catalogue.
 *
 * A moderator's or admin's edit is applied straight away; anyone else's is
 * stored in `topic_starter_changes` and applied — by the same
 * {@link applyTopicStarterChange} — only when a moderator approves it from the
 * admin panel. The change shapes and their validation live in
 * `@debate-ai/webview/lib/topic-starters/changes`, shared with the client.
 *
 * `topic_starter_changes` is created here on first use: the app has no
 * tracked migrations (see `lib/database/ensure-columns.ts`), so
 * `CREATE TABLE IF NOT EXISTS` mirrors its `schema.ts` definition.
 *
 * @module lib/topic-starters/changes
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  describeTopicStarterChange,
  emptyFolders,
  parseTopicStarterChange,
  planReorganize,
  type ArgumentAssignment,
  type TopicStarterChange,
  type TopicStarterChangeRow,
  type TopicStarterChangeStatus,
  type TopicTreeRow,
} from "@debate-ai/reason-docs/lib/topic-starters/changes";
import { normalizeFormat } from "@debate-ai/reason-docs/lib/debate-editor/format";
import type { getDBFromContext } from "@/lib/database/context";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { notifications, staffRoles, topicStarterChanges, topicStarterItems, user } from "@/lib/database/schema";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "topic_starter_changes" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "kind" text NOT NULL,
  "change" text NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "user_id" text,
  "user_email" text,
  "reviewed_by" text,
  "error" text,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL,
  "reviewed_at" integer
)`;
const CREATE_INDEX_SQL = `CREATE INDEX IF NOT EXISTS "idx_topic_starter_changes_status" ON "topic_starter_changes" ("status")`;

let tableReady: Promise<void> | null = null;

function ensureTable(db: Database): Promise<void> {
  tableReady ??= Promise.resolve(db.run(sql.raw(CREATE_TABLE_SQL)))
    .then(() => db.run(sql.raw(CREATE_INDEX_SQL)))
    .then(
      () => undefined,
      (error) => {
        tableReady = null;
        throw error;
      },
    );
  return tableReady;
}

/**
 * Adds any `topic_starter_items` column the live D1 is missing. The app ships
 * no migrations, so a column added to the schema since a database was made —
 * `year` is the one that bit — never arrives, and because Drizzle names every
 * column in an insert or `select()`, one missing column fails every write
 * ("Failed query: insert into topic_starter_items …"). Call before touching
 * the table; it runs once per isolate.
 */
export function ensureTopicStarterColumns(db: Database): Promise<void> {
  return ensureTableColumns(db, topicStarterItems);
}

/** A change that could not be applied, with the reason to show. */
export class TopicStarterChangeError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Most published rows read to resolve a tree-wide change — the by-path route's ceiling. */
const MAX_TREE_ROWS = 5000;

async function readTree(db: Database): Promise<TopicTreeRow[]> {
  return db
    .select({
      id: topicStarterItems.id,
      title: topicStarterItems.title,
      parentId: topicStarterItems.parentId,
      isFolder: topicStarterItems.isFolder,
    })
    .from(topicStarterItems)
    .limit(MAX_TREE_ROWS);
}

async function requireItem(db: Database, id: number) {
  const [row] = await db.select().from(topicStarterItems).where(eq(topicStarterItems.id, id)).limit(1);
  if (!row) throw new TopicStarterChangeError("That Topic Starter item no longer exists.", 404);
  return row;
}

/** Throws unless `parentId` is the top level or a real catalogue folder. */
async function requireFolder(db: Database, parentId: number | null): Promise<void> {
  if (parentId == null) return;
  const [parent] = await db
    .select({ id: topicStarterItems.id })
    .from(topicStarterItems)
    .where(and(eq(topicStarterItems.id, parentId), eq(topicStarterItems.isFolder, true)))
    .limit(1);
  if (!parent) throw new TopicStarterChangeError("That Topic Starters folder no longer exists.");
}

/** `id` and every row beneath it. */
function subtreeIds(rows: readonly TopicTreeRow[], id: number): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    ids.push(current);
    for (const row of rows) if (row.parentId === current) queue.push(row.id);
  }
  return ids;
}

/** Deletes rows in chunks small enough for D1's bound-parameter limit. */
async function deleteIds(db: Database, ids: number[]): Promise<void> {
  for (let index = 0; index < ids.length; index += 50) {
    await db.delete(topicStarterItems).where(inArray(topicStarterItems.id, ids.slice(index, index + 50)));
  }
}

/** Most rows one copy may create — a guard against pasting the whole library into itself. */
const MAX_COPY_ROWS = 2000;

/**
 * Copies a Topic Starter row — a file, or a folder with everything in it —
 * under `parentId` (the top level when null) and returns the new row's id.
 * Every copied row keeps its title, content, format, tags, year and published
 * flag; only the copy's root gets " (copy)" added, and only when it lands
 * beside the original. A folder can't be pasted into its own subtree.
 */
export async function copyTopicStarterItem(db: Database, itemId: number, parentId: number | null): Promise<number> {
  await ensureTopicStarterColumns(db);
  const root = await requireItem(db, itemId);
  await requireFolder(db, parentId);
  const ids = subtreeIds(await readTree(db), itemId);
  if (parentId != null && ids.includes(parentId)) {
    throw new TopicStarterChangeError("A folder cannot be pasted into itself.");
  }
  if (ids.length > MAX_COPY_ROWS) {
    throw new TopicStarterChangeError(`That folder holds more than ${MAX_COPY_ROWS.toLocaleString()} items — too many to copy at once.`);
  }

  // Parents are copied before their children: `subtreeIds` is breadth-first.
  const newIds = new Map<number, number>();
  for (const id of ids) {
    const row = id === root.id ? root : await requireItem(db, id);
    const isRoot = id === root.id;
    const [copy] = await db
      .insert(topicStarterItems)
      .values({
        title: isRoot && (root.parentId ?? null) === parentId ? `${row.title} (copy)` : row.title,
        content: row.content,
        format: row.format,
        parentId: isRoot ? parentId : (newIds.get(row.parentId!) ?? null),
        isFolder: row.isFolder,
        tags: row.tags,
        published: row.published,
        year: row.year,
      })
      .returning({ id: topicStarterItems.id });
    if (!copy) throw new TopicStarterChangeError("The copy could not be saved.", 500);
    newIds.set(id, copy.id);
  }
  return newIds.get(root.id)!;
}

async function insertFolder(db: Database, title: string, parentId: number | null): Promise<number> {
  const [folder] = await db
    .insert(topicStarterItems)
    .values({ title, parentId, isFolder: true, tags: JSON.stringify(["folder"]), published: true })
    .returning();
  if (!folder) throw new TopicStarterChangeError("The folder could not be created.", 500);
  return folder.id;
}

/**
 * Files every assigned file under `Aff/<Type>` / `Neg/<Type>`, creating the
 * folders it needs, then drops the folders the moves emptied. Returns how
 * many files moved.
 */
async function applyReorganize(db: Database, assignments: ArgumentAssignment[]): Promise<number> {
  const rows = await readTree(db);
  const plan = planReorganize(rows, assignments);
  if (plan.moves.length === 0) return 0;

  const folderIds = new Map<string, number>();
  for (const folder of plan.folders) {
    const key = folder.path.join("/");
    if (folder.existingId != null) {
      folderIds.set(key, folder.existingId);
      continue;
    }
    const parentId = folder.path.length === 2 ? folderIds.get(folder.path[0]) ?? null : null;
    const id = await insertFolder(db, folder.path.at(-1)!, parentId);
    folderIds.set(key, id);
    rows.push({ id, title: folder.path.at(-1)!, parentId, isFolder: true });
  }

  // The folders the moved files came from, and everything above them: the
  // only ones a reorganize may clean up. An empty folder it never touched
  // stays — someone may have made it on purpose.
  const byId = new Map(rows.map((row) => [row.id, row]));
  const vacated = new Set<number>();
  for (const move of plan.moves) {
    let parentId = byId.get(move.itemId)?.parentId ?? null;
    while (parentId != null && !vacated.has(parentId)) {
      vacated.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
  }

  const now = new Date();
  for (const move of plan.moves) {
    const parentId = folderIds.get(move.path.join("/"));
    if (parentId == null) continue;
    await db.update(topicStarterItems).set({ parentId, updatedAt: now }).where(eq(topicStarterItems.id, move.itemId));
    const row = rows.find((r) => r.id === move.itemId);
    if (row) row.parentId = parentId;
  }

  await deleteIds(db, emptyFolders(rows, new Set(folderIds.values())).filter((id) => vacated.has(id)));
  return plan.moves.length;
}

/**
 * Applies one change to the live catalogue. Throws a
 * {@link TopicStarterChangeError} with a reader-facing reason when the change
 * no longer fits the tree (its item was deleted, a folder would move into
 * itself, …).
 */
export async function applyTopicStarterChange(db: Database, change: TopicStarterChange): Promise<void> {
  await ensureTopicStarterColumns(db);
  switch (change.kind) {
    case "move": {
      const target = await requireItem(db, change.itemId);
      await requireFolder(db, change.parentId);
      if (target.isFolder && change.parentId != null) {
        if (subtreeIds(await readTree(db), target.id).includes(change.parentId)) {
          throw new TopicStarterChangeError("A folder cannot be moved into its own subtree.");
        }
      }
      if ((target.parentId ?? null) === change.parentId) return;
      await db
        .update(topicStarterItems)
        .set({ parentId: change.parentId, updatedAt: new Date() })
        .where(eq(topicStarterItems.id, change.itemId));
      return;
    }
    case "rename": {
      await requireItem(db, change.itemId);
      await db
        .update(topicStarterItems)
        .set({ title: change.title, updatedAt: new Date() })
        .where(eq(topicStarterItems.id, change.itemId));
      return;
    }
    case "delete": {
      await requireItem(db, change.itemId);
      // No FK-enforced cascade here, so a folder's descendants go with it explicitly.
      await deleteIds(db, subtreeIds(await readTree(db), change.itemId));
      return;
    }
    case "create-folder": {
      await requireFolder(db, change.parentId);
      await insertFolder(db, change.title, change.parentId);
      return;
    }
    case "submit": {
      await requireFolder(db, change.parentId);
      const format = normalizeFormat(change.format);
      await db.insert(topicStarterItems).values({
        title: change.title,
        content: change.content,
        format,
        parentId: change.parentId,
        isFolder: false,
        tags: JSON.stringify([format, "public"]),
        published: true,
        year: change.year,
      });
      return;
    }
    case "reorganize": {
      await applyReorganize(db, change.assignments);
      return;
    }
  }
}

/** Current titles by id, for describing a change in words. */
async function titleMap(db: Database): Promise<Map<number, string>> {
  return new Map((await readTree(db)).map((row) => [row.id, row.title]));
}

/**
 * Stores a change for moderator review and lets the moderators know.
 *
 * @returns The queued change's id.
 */
export async function queueTopicStarterChange(
  db: Database,
  change: TopicStarterChange,
  submitter: { userId: string | null; email: string | null },
  adminEmails: string[],
): Promise<number> {
  await ensureTable(db);
  const summary = describeTopicStarterChange(change, await titleMap(db));
  const [row] = await db
    .insert(topicStarterChanges)
    .values({
      kind: change.kind,
      change: JSON.stringify(change),
      summary,
      status: "pending",
      userId: submitter.userId,
      userEmail: submitter.email,
    })
    .returning({ id: topicStarterChanges.id });
  if (!row) throw new TopicStarterChangeError("The change could not be saved.", 500);
  await notifyTopicStarterModerators(db, adminEmails, {
    title: "Topic Starters change to review",
    body: `${submitter.email ?? "A reader"}: ${summary}`,
  });
  return row.id;
}

function toRow(record: typeof topicStarterChanges.$inferSelect, titles: Map<number, string>): TopicStarterChangeRow | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(record.change);
  } catch {
    return null;
  }
  const result = parseTopicStarterChange(parsed);
  if (!result.ok) return null;
  return {
    id: record.id,
    change: result.change,
    // Re-described with today's titles while pending, so a queued move names
    // what the item is called now; a reviewed change keeps its stored line.
    summary: record.status === "pending" ? describeTopicStarterChange(result.change, titles) : record.summary,
    status: record.status as TopicStarterChangeStatus,
    submittedBy: record.userEmail,
    reviewedBy: record.reviewedBy,
    error: record.error,
    createdAt: record.createdAt.toISOString(),
  };
}

/** Changes in the queue, newest first. A submission's file content is left out. */
export async function listTopicStarterChanges(
  db: Database,
  status: TopicStarterChangeStatus | "all" = "pending",
): Promise<TopicStarterChangeRow[]> {
  await ensureTable(db);
  const query = db.select().from(topicStarterChanges);
  const records = await (status === "all" ? query : query.where(eq(topicStarterChanges.status, status)))
    .orderBy(desc(topicStarterChanges.createdAt), desc(topicStarterChanges.id))
    .limit(200);
  const titles = await titleMap(db);
  return records
    .map((record: typeof topicStarterChanges.$inferSelect) => toRow(record, titles))
    .filter((row: TopicStarterChangeRow | null): row is TopicStarterChangeRow => row !== null)
    .map((row: TopicStarterChangeRow) =>
      row.change.kind === "submit" ? { ...row, change: { ...row.change, content: "" } } : row,
    );
}

/**
 * Approves (applies, then marks approved) or rejects one pending change.
 * A change that no longer applies stays pending with its error recorded, so
 * the moderator sees why and can reject it.
 */
export async function reviewTopicStarterChange(
  db: Database,
  id: number,
  decision: "approve" | "reject",
  reviewer: string | null,
): Promise<TopicStarterChangeRow> {
  await ensureTable(db);
  const [record] = await db.select().from(topicStarterChanges).where(eq(topicStarterChanges.id, id)).limit(1);
  if (!record) throw new TopicStarterChangeError("That change no longer exists.", 404);
  if (record.status !== "pending") throw new TopicStarterChangeError("That change was already reviewed.", 409);

  const row = toRow(record, await titleMap(db));
  if (!row) throw new TopicStarterChangeError("That change could not be read.", 422);

  if (decision === "approve") {
    try {
      await applyTopicStarterChange(db, row.change);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.update(topicStarterChanges).set({ error: message }).where(eq(topicStarterChanges.id, id));
      throw error instanceof TopicStarterChangeError ? error : new TopicStarterChangeError(message, 500);
    }
  }

  const status: TopicStarterChangeStatus = decision === "approve" ? "approved" : "rejected";
  await db
    .update(topicStarterChanges)
    .set({ status, reviewedBy: reviewer, reviewedAt: new Date(), error: null, summary: row.summary })
    .where(eq(topicStarterChanges.id, id));
  return { ...row, status, reviewedBy: reviewer, error: null };
}

/**
 * An in-app notification on every admin and moderator with an account,
 * pointing at the admin panel's Topic starters section. Best-effort: a
 * failed notification never fails the change it announces.
 */
async function notifyTopicStarterModerators(
  db: Database,
  adminEmails: string[],
  message: { title: string; body: string },
): Promise<void> {
  try {
    const moderators = await db.select({ email: staffRoles.email }).from(staffRoles);
    const emails = [...new Set([...adminEmails, ...moderators.map((row: { email: string }) => row.email.toLowerCase())])];
    if (emails.length === 0) return;
    const recipients = await db.select({ id: user.id }).from(user).where(inArray(user.email, emails));
    if (recipients.length === 0) return;
    const createdAt = new Date();
    await db.insert(notifications).values(
      recipients.map((recipient: { id: string }) => ({
        userId: recipient.id,
        type: "topic_starter_change",
        title: message.title,
        body: message.body,
        link: "/admin#topic-starters",
        createdAt,
      })),
    );
  } catch (error) {
    console.error("Failed to notify moderators of a Topic Starters change:", error);
  }
}
