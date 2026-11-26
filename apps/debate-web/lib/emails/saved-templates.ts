/**
 * @fileoverview Saved email templates for the admin Emails section: a name,
 * a subject and a plain-text body (the format `parseEmailBody` in
 * `@debate-ai/emails` documents), kept in D1.
 */

import { sql } from "drizzle-orm";
import { type Database, ensureEmailTables } from "./tables";

export const MAX_TEMPLATE_NAME = 100;
export const MAX_SUBJECT = 200;
export const MAX_BODY = 50_000;

export interface SavedEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  updatedAt: number;
  updatedBy: string | null;
}

export class TemplateInputError extends Error {}

export function validateTemplateInput(input: { name?: unknown; subject?: unknown; body?: unknown }): {
  name: string;
  subject: string;
  body: string;
} {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const body = typeof input.body === "string" ? input.body : "";
  if (!name) throw new TemplateInputError("Give the template a name.");
  if (name.length > MAX_TEMPLATE_NAME) throw new TemplateInputError(`Template names are at most ${MAX_TEMPLATE_NAME} characters.`);
  if (!subject) throw new TemplateInputError("Enter a subject.");
  if (subject.length > MAX_SUBJECT || /[\r\n]/.test(subject)) {
    throw new TemplateInputError(`The subject is one line of at most ${MAX_SUBJECT} characters.`);
  }
  if (!body.trim()) throw new TemplateInputError("Write the email body.");
  if (body.length > MAX_BODY) throw new TemplateInputError(`The body is at most ${MAX_BODY} characters.`);
  return { name, subject, body };
}

function toTemplate(row: Record<string, unknown>): SavedEmailTemplate {
  return {
    id: String(row.id),
    name: String(row.name),
    subject: String(row.subject),
    body: String(row.body),
    updatedAt: Number(row.updatedAt ?? 0),
    updatedBy: (row.updatedBy as string | null) ?? null,
  };
}

export async function listSavedTemplates(db: Database): Promise<SavedEmailTemplate[]> {
  await ensureEmailTables(db);
  const rows = (await db.all(
    sql`SELECT id, name, subject, body, updated_at AS updatedAt, updated_by AS updatedBy FROM email_templates ORDER BY name COLLATE NOCASE`,
  )) as Record<string, unknown>[];
  return rows.map(toTemplate);
}

export async function getSavedTemplate(db: Database, id: string): Promise<SavedEmailTemplate | null> {
  await ensureEmailTables(db);
  const [row] = (await db.all(
    sql`SELECT id, name, subject, body, updated_at AS updatedAt, updated_by AS updatedBy FROM email_templates WHERE id = ${id} LIMIT 1`,
  )) as Record<string, unknown>[];
  return row ? toTemplate(row) : null;
}

/** Creates a template (no `id`) or replaces one. Returns `null` when `id` does not exist. */
export async function saveSavedTemplate(
  db: Database,
  input: { id?: string; name: string; subject: string; body: string },
  updatedBy: string | null,
  now = Date.now(),
): Promise<SavedEmailTemplate | null> {
  await ensureEmailTables(db);
  if (input.id) {
    if (!(await getSavedTemplate(db, input.id))) return null;
    await db.run(
      sql`UPDATE email_templates SET name = ${input.name}, subject = ${input.subject}, body = ${input.body},
                 updated_at = ${now}, updated_by = ${updatedBy} WHERE id = ${input.id}`,
    );
    return getSavedTemplate(db, input.id);
  }
  const id = crypto.randomUUID();
  await db.run(
    sql`INSERT INTO email_templates (id, name, subject, body, created_at, updated_at, updated_by)
        VALUES (${id}, ${input.name}, ${input.subject}, ${input.body}, ${now}, ${now}, ${updatedBy})`,
  );
  return getSavedTemplate(db, id);
}

export async function deleteSavedTemplate(db: Database, id: string): Promise<void> {
  await ensureEmailTables(db);
  await db.run(sql`DELETE FROM email_templates WHERE id = ${id}`);
}
