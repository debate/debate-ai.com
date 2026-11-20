import { NextResponse } from "next/server";
import type { CopyResult } from "@debate-ai/file-market";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { PurchaseRefused } from "@/lib/market/queries";
import { copyPublishedFile, getPublisherBySlug } from "@/lib/market/publishers";

/**
 * Saves a copy of one of a publisher's files to the viewer's own files.
 *
 * POST — open to the publisher's owner and to readers with a live
 *   subscription (402 otherwise). Answers the copy's document id.
 */
export const POST = withRouteErrors(
  "POST /api/market/publishers/[slug]/files/[documentId]/copy",
  async (_req: Request, context: { params: Promise<{ slug: string; documentId: string }> }) => {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Sign in to save this file." }, { status: 401 });
    const { slug, documentId } = await context.params;
    const id = Number(documentId);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Unknown file." }, { status: 404 });

    const db = await getDBFromContext();
    const row = await getPublisherBySlug(db, slug);
    if (!row) return NextResponse.json({ error: "There's no publisher at this address." }, { status: 404 });

    try {
      const body: CopyResult = { documentId: await copyPublishedFile(db, row, id, userId) };
      return NextResponse.json(body, { status: 201 });
    } catch (err) {
      if (err instanceof PurchaseRefused) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }
  },
);
