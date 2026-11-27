import { NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { authors, citations } from "@/lib/database/schema";
import { ensureAuthorTables } from "@/lib/authors/ensure-tables";
import { seedAuthorsIntoDb } from "@/lib/authors/seed-authors-to-db";

/**
 * Loads the committed authors snapshot into the `authors`, `citations` and
 * `citation_authors` tables that `/authors` reads from.
 *
 * The CLI equivalent (`bun run db:sync:authors`) rebuilds the snapshot from the
 * docs first; this applies the snapshot already in the deployed bundle to the
 * deployment's own D1 binding. Re-running is safe: the tables are replaced in
 * one atomic batch.
 *
 * Until it is run, `/authors` serves correct results from the snapshot in
 * memory; seeding moves that work into SQL.
 */
export async function POST() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = await getDBFromContext();
    const result = await seedAuthorsIntoDb(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error syncing authors:", error);
    const err = error as Error & { cause?: unknown };
    const cause = err.cause instanceof Error ? err.cause.message : undefined;
    return NextResponse.json(
      {
        error: "Failed to sync authors",
        details: cause ?? err.message?.slice(0, 500),
        query: cause ? err.message?.slice(0, 200) : undefined,
      },
      { status: 500 },
    );
  }
}

/** Current state of the tables, so the admin page can tell whether to sync. */
export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = await getDBFromContext();
    await ensureAuthorTables(db);
    const [[authorRow], [citationRow]] = await Promise.all([
      db.select({ rows: count() }).from(authors),
      db.select({ rows: count() }).from(citations),
    ]);
    return NextResponse.json({
      authors: authorRow?.rows ?? 0,
      citations: citationRow?.rows ?? 0,
      servingFrom: (authorRow?.rows ?? 0) > 0 ? "sql" : "json",
    });
  } catch (error) {
    console.error("Error reading authors sync status:", error);
    return NextResponse.json({ authors: 0, citations: 0, servingFrom: "json" });
  }
}
