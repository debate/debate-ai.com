import { NextResponse } from "next/server";
import { count, max } from "drizzle-orm";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { videos } from "@/lib/database/schema";
import { seedVideosIntoDb } from "@/lib/videos/seed-videos-to-db";

/**
 * Loads the bundled video JSON assets into the `videos` table that
 * `/api/videos` pages over.
 *
 * The CLI equivalent (`bun run db:seed:videos:d1`) needs wrangler credentials;
 * this runs the same statements against the deployment's own D1 binding, so a
 * fresh database — or one that has fallen behind a YouTube sync — can be
 * seeded from the admin page. Re-running is safe: rows are upserted by video
 * id and rows the assets no longer carry are pruned.
 *
 * Until it is run, `/api/videos` serves correct results from the JSON assets
 * in memory; seeding moves that work into SQL.
 */
export async function POST() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = await getDBFromContext();
    const result = await seedVideosIntoDb(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error seeding videos:", error);
    // Drizzle wraps a driver failure in an error whose message is the whole
    // (very long) statement, burying the reason D1 rejected it — so report
    // the cause, and keep the echoed statement short enough to read.
    const err = error as Error & { cause?: unknown };
    const cause = err.cause instanceof Error ? err.cause.message : undefined;
    return NextResponse.json(
      {
        error: "Failed to seed videos",
        details: cause ?? err.message?.slice(0, 500),
        query: cause ? err.message?.slice(0, 200) : undefined,
      },
      { status: 500 },
    );
  }
}

/** Current state of the table, so the admin page can tell whether to seed. */
export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = await getDBFromContext();
    const [row] = await db
      .select({ rows: count(), lastSeededAt: max(videos.updatedAt) })
      .from(videos);

    return NextResponse.json({
      rows: row?.rows ?? 0,
      lastSeededAt: row?.lastSeededAt ?? null,
      // An unseeded table is not an outage: the feed falls back to the JSON
      // assets, so this only reports whether SQL is carrying the reads.
      servingFrom: (row?.rows ?? 0) > 0 ? "sql" : "json",
    });
  } catch (error) {
    console.error("Error reading video seed status:", error);
    return NextResponse.json({ rows: 0, lastSeededAt: null, servingFrom: "json" });
  }
}
