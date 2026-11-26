/**
 * @fileoverview Saved email lists for the admin Emails section: a name and a
 * validated, deduplicated set of addresses, kept in D1.
 */

import { sql } from "drizzle-orm";
import { MAX_LIST_RECIPIENTS, parseRecipientList } from "@debate-ai/webview/lib/admin/email-recipients";
import { type Database, ensureEmailTables } from "./tables";

export const MAX_LIST_NAME = 100;

export interface EmailListSummary {
  id: string;
  name: string;
  count: number;
  updatedAt: number;
  updatedBy: string | null;
}

export interface EmailList extends EmailListSummary {
  emails: string[];
}

export class EmailListError extends Error {
  constructor(
    message: string,
    readonly invalid: string[] = [],
  ) {
    super(message);
  }
}

/**
 * Validates a list as typed: a name, then addresses in any separator
 * `parseRecipientList` accepts. Any invalid entry rejects the whole list, so
 * a typo is never silently dropped.
 */
export function validateListInput(name: unknown, rawEmails: unknown): { name: string; emails: string[]; duplicates: number } {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) throw new EmailListError("Give the list a name.");
  if (trimmed.length > MAX_LIST_NAME) throw new EmailListError(`List names are at most ${MAX_LIST_NAME} characters.`);
  const isStringArray = Array.isArray(rawEmails) && rawEmails.every((entry) => typeof entry === "string");
  if (typeof rawEmails !== "string" && !isStringArray) throw new EmailListError("Provide the addresses as text.");
  const { valid, invalid, duplicates } = parseRecipientList(rawEmails as string | string[]);
  if (invalid.length > 0) {
    throw new EmailListError(
      `Not email addresses: ${invalid.slice(0, 10).join(", ")}${invalid.length > 10 ? "…" : ""}`,
      invalid,
    );
  }
  if (valid.length === 0) throw new EmailListError("Add at least one email address.");
  if (valid.length > MAX_LIST_RECIPIENTS) {
    throw new EmailListError(`A list holds at most ${MAX_LIST_RECIPIENTS} addresses (got ${valid.length}).`);
  }
  return { name: trimmed, emails: valid, duplicates };
}

function summary(row: Record<string, unknown>): EmailListSummary {
  return {
    id: String(row.id),
    name: String(row.name),
    count: Number(row.count ?? 0),
    updatedAt: Number(row.updatedAt ?? 0),
    updatedBy: (row.updatedBy as string | null) ?? null,
  };
}

export async function listEmailLists(db: Database): Promise<EmailListSummary[]> {
  await ensureEmailTables(db);
  const rows = (await db.all(
    sql`SELECT id, name, count, updated_at AS updatedAt, updated_by AS updatedBy FROM email_lists ORDER BY name COLLATE NOCASE`,
  )) as Record<string, unknown>[];
  return rows.map(summary);
}

export async function getEmailList(db: Database, id: string): Promise<EmailList | null> {
  await ensureEmailTables(db);
  const [row] = (await db.all(
    sql`SELECT id, name, emails, count, updated_at AS updatedAt, updated_by AS updatedBy FROM email_lists WHERE id = ${id} LIMIT 1`,
  )) as Record<string, unknown>[];
  if (!row) return null;
  let emails: string[] = [];
  try {
    const parsed = JSON.parse(String(row.emails));
    if (Array.isArray(parsed)) emails = parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    emails = [];
  }
  return { ...summary(row), emails };
}

/** Creates a list (no `id`) or replaces one's name and addresses. Returns `null` when `id` does not exist. */
export async function saveEmailList(
  db: Database,
  input: { id?: string; name: string; emails: string[] },
  updatedBy: string | null,
  now = Date.now(),
): Promise<EmailList | null> {
  await ensureEmailTables(db);
  const json = JSON.stringify(input.emails);
  if (input.id) {
    if (!(await getEmailList(db, input.id))) return null;
    await db.run(
      sql`UPDATE email_lists SET name = ${input.name}, emails = ${json}, count = ${input.emails.length},
                 updated_at = ${now}, updated_by = ${updatedBy} WHERE id = ${input.id}`,
    );
    return getEmailList(db, input.id);
  }
  const id = crypto.randomUUID();
  await db.run(
    sql`INSERT INTO email_lists (id, name, emails, count, created_at, updated_at, updated_by)
        VALUES (${id}, ${input.name}, ${json}, ${input.emails.length}, ${now}, ${now}, ${updatedBy})`,
  );
  return getEmailList(db, id);
}

export async function deleteEmailList(db: Database, id: string): Promise<void> {
  await ensureEmailTables(db);
  await db.run(sql`DELETE FROM email_lists WHERE id = ${id}`);
}
