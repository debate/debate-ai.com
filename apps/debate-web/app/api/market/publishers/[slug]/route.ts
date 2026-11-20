import { NextResponse } from "next/server";
import { parsePublisherRequest } from "@debate-ai/file-market";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { describePublisher, getPublisherBySlug, publisherPage, updatePublisher } from "@/lib/market/publishers";

/**
 * One research publisher's page.
 *
 * GET — the publisher, the files it has published (details only), and the
 *   viewer's subscription and wallet. Open to everyone.
 * PUT — edits it; only its owner may.
 */
export const GET = withRouteErrors(
  "GET /api/market/publishers/[slug]",
  async (_req: Request, context: { params: Promise<{ slug: string }> }) => {
    const db = await getDBFromContext();
    const row = await getPublisherBySlug(db, (await context.params).slug);
    if (!row) return NextResponse.json({ error: "There's no publisher at this address." }, { status: 404 });
    return NextResponse.json(await publisherPage(db, row, await getUserId()));
  },
);

export const PUT = withRouteErrors(
  "PUT /api/market/publishers/[slug]",
  async (req: Request, context: { params: Promise<{ slug: string }> }) => {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Sign in to edit this publisher." }, { status: 401 });
    const db = await getDBFromContext();
    const row = await getPublisherBySlug(db, (await context.params).slug);
    if (!row) return NextResponse.json({ error: "There's no publisher at this address." }, { status: 404 });
    if (row.ownerId !== userId) return NextResponse.json({ error: "Only the publisher's owner can edit it." }, { status: 403 });

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = parsePublisherRequest(payload);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const updated = await updatePublisher(db, row, parsed.value);
    return NextResponse.json({ publisher: await describePublisher(db, updated) });
  },
);
