import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { UNSETTLED_STATUSES, fillTabroomResults, listTabroomResultRows } from "@/lib/videos/fill-tabroom-results";
import { tabroomFetch } from "@/lib/judge-paradigms/tabroom";

/**
 * Lists the high-school rounds a lookup couldn't settle, for the admin card.
 *
 * Query: `?status=not_found,ambiguous` — any of `not_found`, `ambiguous`,
 * `error`, `conflict`, `winner_not_explicit` (default `not_found`).
 * Responds `{ rows, total }`; at most 500 rows.
 */
export async function GET(request: Request) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const requested = (new URL(request.url).searchParams.get("status") ?? "not_found").split(",").map((s) => s.trim());
  const statuses = requested.filter((s) => (UNSETTLED_STATUSES as readonly string[]).includes(s));
  try {
    const db = await getDBFromContext();
    return NextResponse.json(await listTabroomResultRows(db, statuses.length ? statuses : ["not_found"]));
  } catch (error) {
    console.error("Error listing Tabroom results:", error);
    return NextResponse.json({ error: "Failed to list Tabroom results" }, { status: 500 });
  }
}

/**
 * Looks one batch of high-school rounds up on Tabroom and saves the winner,
 * ballot count, judges and squirrels. See `lib/videos/fill-tabroom-results.ts`.
 *
 * Body (optional JSON): `{ since?: number }` — unix seconds; rows checked at
 * or after it are skipped (0, the default, finishes rows never checked). Call
 * again until the response's `remaining` is 0.
 */
export async function POST(request: Request) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { since?: unknown };
  const since = typeof body?.since === "number" && Number.isFinite(body.since) ? body.since : 0;

  try {
    const db = await getDBFromContext();
    const result = await fillTabroomResults(db, { since, fetchImpl: tabroomFetch() });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error filling Tabroom results:", error);
    const err = error as Error & { cause?: unknown };
    const cause = err.cause instanceof Error ? err.cause.message : undefined;
    return NextResponse.json(
      { error: "Failed to fill Tabroom results", details: cause ?? err.message?.slice(0, 500) },
      { status: 500 },
    );
  }
}
