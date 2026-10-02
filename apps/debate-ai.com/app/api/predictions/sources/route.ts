import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { listEventEntries, listOpenPanels, listTabroomEvents } from "@/lib/predictions/queries";
import type { PredictionSourcesResponse } from "@debate/predictions";

/**
 * Hosted Tabroom data a market can be tied to, so it settles itself.
 *
 * GET — events of hosted tournaments that are upcoming, running or ended in
 *   the last two weeks. With `?eventId=`, also that event's entries (the
 *   outcomes of a "who wins the tournament" market) and its undecided
 *   head-to-head rounds (each one a "who wins this debate" market).
 *
 * These are the `debate-tournaments` tables in the same D1. A database
 * without them answers empty lists.
 */

export const GET = withRouteErrors("GET /api/predictions/sources", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to open a market." }, { status: 401 });
  }

  const db = await getDBFromContext();
  const rawEventId = req.nextUrl.searchParams.get("eventId");
  const eventId = rawEventId ? Number(rawEventId) : null;
  if (eventId !== null && !(Number.isInteger(eventId) && eventId > 0)) {
    return NextResponse.json({ error: "That event id isn't valid." }, { status: 400 });
  }

  const body: PredictionSourcesResponse = { events: await listTabroomEvents(db) };
  if (eventId !== null) {
    const [entries, panels] = await Promise.all([listEventEntries(db, eventId), listOpenPanels(db, eventId)]);
    body.entries = entries;
    body.panels = panels;
  }
  return NextResponse.json(body);
});
