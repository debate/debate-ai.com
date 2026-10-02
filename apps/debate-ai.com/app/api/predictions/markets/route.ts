import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { getStaffAccess } from "@/lib/auth/admin";
import { withRouteErrors } from "@/lib/api/route-errors";
import {
  countOpenMarketsBy,
  entryOutcomes,
  getMarket,
  getPanelEntries,
  getViewer,
  insertMarket,
  listEventEntries,
} from "@/lib/predictions/queries";
import { findRatedTeam } from "@/lib/predictions/ratings";
import {
  MAX_OPEN_MARKETS_PER_CREATOR,
  MAX_OUTCOMES,
  RATING_OUTCOMES,
  manualOutcomes,
  parseNewMarket,
  type MarketOutcome,
  type MarketSource,
} from "debate-predictions";

/**
 * Opens a prediction market.
 *
 * POST { kind, title, description?, closesAt, outcomes?, tabroomPanelId?,
 *   tabroomEventId?, rating? } — returns the market (201) as the board shows it.
 *
 * - `debate` — two outcomes, typed by hand, or taken from a hosted Tabroom
 *   round (`tabroomPanelId`), which then settles the market itself.
 * - `tournament` — up to 32 outcomes by hand, or every entry of a hosted
 *   Tabroom event (`tabroomEventId`), settled from its final results.
 * - `rating` — a `debate-rankings` team (`rating: { dataset, hash }`); the
 *   outcomes are always "rises" / "doesn't rise", judged against the rating
 *   recorded now once betting closes.
 *
 * Account-only; guest accounts and anyone with ten markets already open are
 * refused.
 */

export const POST = withRouteErrors("POST /api/predictions/markets", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to open a market." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseNewMarket(payload, Math.floor(Date.now() / 1000));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const market = parsed.value;

  const db = await getDBFromContext();
  const viewer = await getViewer(db, userId);
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to open a market." }, { status: 401 });
  }
  if (viewer.isAnonymous) {
    return NextResponse.json({ error: "Create an account to open a market." }, { status: 403 });
  }
  if ((await countOpenMarketsBy(db, userId)) >= MAX_OPEN_MARKETS_PER_CREATOR) {
    return NextResponse.json(
      { error: `You already have ${MAX_OPEN_MARKETS_PER_CREATOR} markets open. Wait for one to settle first.` },
      { status: 429 },
    );
  }

  let outcomes: MarketOutcome[];
  let source: MarketSource = { type: "manual" };
  if (market.kind === "rating") {
    const team = await findRatedTeam(market.rating!.dataset, market.rating!.hash);
    if (!team) {
      return NextResponse.json({ error: "That team isn't in the rankings." }, { status: 404 });
    }
    outcomes = [...RATING_OUTCOMES];
    source = { type: "rating", dataset: team.dataset, hash: team.hash, name: team.name, school: team.school, baseline: team.rating };
  } else if (market.tabroomPanelId !== null) {
    const entries = await getPanelEntries(db, market.tabroomPanelId);
    if (!entries) {
      return NextResponse.json({ error: "That round isn't a hosted head-to-head round." }, { status: 404 });
    }
    outcomes = entryOutcomes(entries);
    source = { type: "tabroom-panel", panelId: market.tabroomPanelId };
  } else if (market.tabroomEventId !== null) {
    const entries = await listEventEntries(db, market.tabroomEventId);
    if (entries.length < 2) {
      return NextResponse.json({ error: "That event doesn't have two entries yet." }, { status: 404 });
    }
    if (entries.length > MAX_OUTCOMES) {
      return NextResponse.json(
        { error: `That event has ${entries.length} entries; a market can list at most ${MAX_OUTCOMES}.` },
        { status: 400 },
      );
    }
    outcomes = entryOutcomes(entries);
    source = { type: "tabroom-event", eventId: market.tabroomEventId };
  } else {
    outcomes = manualOutcomes(market.outcomes);
  }

  const id = crypto.randomUUID();
  await insertMarket(db, {
    id,
    creatorId: userId,
    kind: market.kind,
    title: market.title,
    description: market.description,
    outcomes,
    source,
    closesAt: market.closesAt,
  });

  const isStaff = (await getStaffAccess()).canEditContent;
  return NextResponse.json(await getMarket(db, id, { id: userId, isStaff }), { status: 201 });
});
