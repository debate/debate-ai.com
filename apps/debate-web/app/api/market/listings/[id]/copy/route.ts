import { NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { copyListingToDocuments, getListingRow, ownsListing } from "@/lib/market/queries";
import type { CopyResult } from "@debate-ai/file-market";

/**
 * POST — saves another copy of a file the viewer bought (or sells) to their
 * own files, e.g. after deleting the one the purchase saved.
 */
export const POST = withRouteErrors(
  "POST /api/market/listings/[id]/copy",
  async (_req: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const { id } = await context.params;
    const db = await getDBFromContext();
    const row = await getListingRow(db, id);
    if (!row || !(await ownsListing(db, row, userId))) {
      return NextResponse.json({ error: "Buy this file to save a copy." }, { status: 403 });
    }
    const body: CopyResult = { documentId: await copyListingToDocuments(db, row, userId) };
    return NextResponse.json(body, { status: 201 });
  },
);
