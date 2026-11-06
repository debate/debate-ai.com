import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { fillComputedTitles } from "@/lib/videos/fill-computed-titles";

/**
 * Fills `videos.computed_title` — the standardized round title with that
 * season's ranks and the debaters' full last names — one season per call.
 * See `lib/videos/fill-computed-titles.ts`.
 *
 * Body (optional JSON): `{ season?: number }`. With no season the oldest one
 * is handled; the response's `nextSeason` is the one to send next, `null`
 * after the last.
 */
export async function POST(request: Request) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { season?: unknown };
  const season = typeof body?.season === "number" && Number.isInteger(body.season) ? body.season : null;

  try {
    const db = await getDBFromContext();
    const result = await fillComputedTitles(db, { season });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error filling computed titles:", error);
    const err = error as Error & { cause?: unknown };
    const cause = err.cause instanceof Error ? err.cause.message : undefined;
    return NextResponse.json(
      { error: "Failed to fill computed titles", details: cause ?? err.message?.slice(0, 500) },
      { status: 500 },
    );
  }
}
