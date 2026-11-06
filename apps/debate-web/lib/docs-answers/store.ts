/**
 * @fileoverview `docs_question_answers`: answers to the docs' suggested
 * questions, saved per page and question and shared with every reader
 * (`/api/docs-answers`; client and rules in
 * `@debate-ai/help-docs/saved-answers`).
 *
 * An answer depends on the page and the question, not on who asked, so the
 * first one saved for a page and question is kept and served to everyone; a
 * later save of the same question is answered with the stored copy. Only
 * staff delete.
 *
 * The table is created here on first use: the app has no tracked migrations
 * (see `lib/database/ensure-columns.ts`).
 *
 * @module lib/docs-answers/store
 */

import { sql } from "drizzle-orm";
import { normalizeQuestion, type SavedAnswer, type SavedAnswerWrite } from "@debate-ai/help-docs/saved-answers";
import type { getDBFromContext } from "@/lib/database/context";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

/** Most answers one page keeps. */
export const MAX_ANSWERS_PER_PAGE = 300;

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "docs_question_answers" (
  "page" text NOT NULL,
  "question_key" text NOT NULL,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "created_by" text,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL,
  PRIMARY KEY ("page", "question_key")
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

/** Every answer saved for `page`, oldest first. */
export async function listDocsAnswers(db: Database, page: string): Promise<SavedAnswer[]> {
  await ensureTable(db);
  const rows = (await db.all(
    sql`SELECT question, answer FROM docs_question_answers WHERE page = ${page} ORDER BY created_at, rowid LIMIT ${MAX_ANSWERS_PER_PAGE}`,
  )) as SavedAnswer[];
  return rows.map(({ question, answer }) => ({ question: String(question), answer: String(answer) }));
}

export interface SaveDocsAnswerResult {
  /** Whether this write is what is now stored. */
  stored: boolean;
  /** What every reader now gets for this question. */
  answer: SavedAnswer;
}

/**
 * Saves an answer unless the page already has one for the question.
 *
 * @returns `null` when the page already holds {@link MAX_ANSWERS_PER_PAGE}.
 */
export async function saveDocsAnswer(
  db: Database,
  write: SavedAnswerWrite,
  userId: string | null,
): Promise<SaveDocsAnswerResult | null> {
  await ensureTable(db);
  const key = normalizeQuestion(write.question);
  const [existing] = (await db.all(
    sql`SELECT question, answer FROM docs_question_answers WHERE page = ${write.page} AND question_key = ${key} LIMIT 1`,
  )) as SavedAnswer[];
  if (existing) return { stored: false, answer: { question: String(existing.question), answer: String(existing.answer) } };

  const [count] = (await db.all(
    sql`SELECT COUNT(*) AS n FROM docs_question_answers WHERE page = ${write.page}`,
  )) as Array<{ n: number }>;
  if (Number(count?.n ?? 0) >= MAX_ANSWERS_PER_PAGE) return null;

  await db.run(
    sql`INSERT INTO docs_question_answers (page, question_key, question, answer, created_by)
        VALUES (${write.page}, ${key}, ${write.question}, ${write.answer}, ${userId})
        ON CONFLICT (page, question_key) DO NOTHING`,
  );
  const [stored] = (await db.all(
    sql`SELECT question, answer FROM docs_question_answers WHERE page = ${write.page} AND question_key = ${key} LIMIT 1`,
  )) as SavedAnswer[];
  const answer = stored
    ? { question: String(stored.question), answer: String(stored.answer) }
    : { question: write.question, answer: write.answer };
  return { stored: answer.answer === write.answer, answer };
}

/** Deletes one question's answer on `page`, or, without a question, all of the page's. */
export async function deleteDocsAnswers(db: Database, page: string, question?: string): Promise<void> {
  await ensureTable(db);
  if (question) {
    await db.run(
      sql`DELETE FROM docs_question_answers WHERE page = ${page} AND question_key = ${normalizeQuestion(question)}`,
    );
  } else {
    await db.run(sql`DELETE FROM docs_question_answers WHERE page = ${page}`);
  }
}
