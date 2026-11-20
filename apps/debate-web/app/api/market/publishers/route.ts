import { NextResponse } from "next/server";
import { parsePublisherRequest } from "@debate-ai/file-market";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getMarketViewer, PurchaseRefused } from "@/lib/market/queries";
import { createPublisher, describePublisher, listOwnPublishers } from "@/lib/market/publishers";

/**
 * Research publishers.
 *
 * GET — the publishers the viewer runs (`{ publishers }`), for the file
 *   details dialog's picker.
 * POST — creates one owned by the viewer. Guest accounts can't.
 */
export const GET = withRouteErrors("GET /api/market/publishers", async () => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ publishers: [] });
  const db = await getDBFromContext();
  return NextResponse.json({ publishers: await listOwnPublishers(db, userId) });
});

export const POST = withRouteErrors("POST /api/market/publishers", async (req: Request) => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to create a publisher." }, { status: 401 });
  const db = await getDBFromContext();
  const viewer = await getMarketViewer(db, userId);
  if (!viewer) return NextResponse.json({ error: "Sign in to create a publisher." }, { status: 401 });
  if (viewer.isAnonymous) {
    return NextResponse.json({ error: "Create an account to publish research." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = parsePublisherRequest(payload);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const row = await createPublisher(db, userId, parsed.value);
    return NextResponse.json({ publisher: await describePublisher(db, row) }, { status: 201 });
  } catch (err) {
    if (err instanceof PurchaseRefused) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
});
