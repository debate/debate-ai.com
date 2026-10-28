import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getViewer } from "@/lib/practice-partners/queries";
import { upsertListing } from "@/lib/judge-pool/queries";
import { isoDay } from "@debate-ai/practice-rounds/src/judge-pool/season-calendar";
import { parseJudgeListing } from "@debate-ai/practice-rounds/src/judge-pool/validation";

/**
 * The viewer's judge listing.
 *
 * PUT { active, weekends, states, canTravel, formats, philosophy } — replaces
 *   the listing and returns it as stored. `weekends` are Saturday keys of up to
 *   three upcoming circuit-calendar weekends. `active: false` takes the judge
 *   out of the pool without forgetting the listing.
 *
 * Guest accounts may not list themselves: an organizer hiring a judge needs
 * someone who will still be there on the weekend.
 */

export const PUT = withRouteErrors("PUT /api/judge-pool/listing", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to volunteer as a judge." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const listing = parseJudgeListing(payload, isoDay());
  if (!listing.ok) {
    return NextResponse.json({ error: listing.error }, { status: 400 });
  }

  const db = await getDBFromContext();
  const viewer = await getViewer(db, userId);
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to volunteer as a judge." }, { status: 401 });
  }
  if (viewer.isAnonymous && listing.value.active) {
    return NextResponse.json({ error: "Create an account to volunteer as a judge." }, { status: 403 });
  }

  await upsertListing(db, userId, listing.value);
  return NextResponse.json(listing.value);
});
