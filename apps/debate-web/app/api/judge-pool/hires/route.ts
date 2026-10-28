import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getViewer, loadBlockedIds } from "@/lib/practice-partners/queries";
import {
  countPendingSent,
  describeHire,
  getActiveListing,
  getHire,
  hasOpenRequest,
  insertHire,
  notifyJudgePool,
} from "@/lib/judge-pool/queries";
import { isoDay } from "@debate-ai/practice-rounds/src/judge-pool/season-calendar";
import { MAX_PENDING_HIRES } from "@debate-ai/practice-rounds/src/judge-pool/types";
import { parseHireRequest } from "@debate-ai/practice-rounds/src/judge-pool/validation";

/**
 * Hire a judge from the pool.
 *
 * POST { judgeId, tournamentName, weekend, offer, message } — asks a listed
 *   judge to judge the organizer's tournament on one of the weekends they
 *   offered, and notifies them. Returns the request as both sides will see it.
 *
 * Refused when the judge isn't listed (or is blocked either way — the same
 * reply, so it doesn't reveal the block), isn't free that weekend, already has
 * an open request from this organizer for it, or the organizer already has
 * {@link MAX_PENDING_HIRES} requests waiting. The offer is text: no payment is
 * taken yet.
 */

export const POST = withRouteErrors("POST /api/judge-pool/hires", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to hire a judge." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const today = isoDay();
  const request = parseHireRequest(payload, today);
  if (!request.ok) {
    return NextResponse.json({ error: request.error }, { status: 400 });
  }
  if (request.value.judgeId === userId) {
    return NextResponse.json({ error: "You can't hire yourself." }, { status: 400 });
  }

  const db = await getDBFromContext();
  const viewer = await getViewer(db, userId);
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to hire a judge." }, { status: 401 });
  }
  if (viewer.isAnonymous) {
    return NextResponse.json({ error: "Create an account to hire a judge." }, { status: 403 });
  }

  const [listing, blocked] = await Promise.all([
    getActiveListing(db, request.value.judgeId, today),
    loadBlockedIds(db, userId),
  ]);
  if (!listing || blocked.has(request.value.judgeId)) {
    return NextResponse.json({ error: "That judge isn't taking hire requests right now." }, { status: 404 });
  }
  if (!listing.weekends.includes(request.value.weekend)) {
    return NextResponse.json({ error: "That judge isn't available that weekend." }, { status: 409 });
  }
  if (await hasOpenRequest(db, userId, request.value.judgeId, request.value.weekend)) {
    return NextResponse.json({ error: "You've already asked this judge for that weekend." }, { status: 409 });
  }
  if ((await countPendingSent(db, userId)) >= MAX_PENDING_HIRES) {
    return NextResponse.json(
      { error: `You have ${MAX_PENDING_HIRES} hire requests waiting already. Cancel one or wait for answers.` },
      { status: 429 },
    );
  }

  const id = await insertHire(db, userId, request.value);
  const offer = request.value.offer ? ` Offer: ${request.value.offer}.` : "";
  await notifyJudgePool(db, request.value.judgeId, {
    title: `${viewer.name} wants to hire you to judge`,
    body: `${describeHire(request.value)}.${offer}`,
  });

  const hire = await getHire(db, id);
  if (!hire) {
    return NextResponse.json({ error: "Could not send your hire request." }, { status: 500 });
  }
  const { organizerId: _organizerId, judgeId: _judgeId, ...wire } = hire;
  return NextResponse.json(wire, { status: 201 });
});
