import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getListing, getMarketViewer, listingsForDocuments, PurchaseRefused, upsertListing } from "@/lib/market/queries";
import { documents } from "@/lib/database/schema";
import { and, eq } from "drizzle-orm";
import { outlineFromHtml, parseSellRequest, type SellResult } from "@debate/file-market";

/**
 * Selling a file.
 *
 * GET ?documentId=<id> — the viewer's open listing for one of their files, if
 *   any (`{ listing: { id, priceCents } | null }`), so the Sell dialog can
 *   show the current price.
 *
 * POST { documentId, priceCents, outline? } — lists one of the viewer's own
 *   files for sale, or reprices an existing listing and refreshes the copy
 *   buyers get. `outline` is the free preview (the file's headings); for an
 *   HTML document it can be omitted and is read from the file here, while a
 *   `.cmir` upload needs the browser to send it.
 */

export const GET = withRouteErrors("GET /api/market/listings", async (req: NextRequest) => {
  const userId = await getUserId();
  const documentId = Number(req.nextUrl.searchParams.get("documentId"));
  if (!userId || !Number.isInteger(documentId) || documentId <= 0) {
    return NextResponse.json({ listing: null });
  }
  const db = await getDBFromContext();
  const [listing] = await listingsForDocuments(db, userId, [documentId]);
  return NextResponse.json({ listing: listing ? { id: listing.id, priceCents: listing.priceCents } : null });
});

export const POST = withRouteErrors("POST /api/market/listings", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to sell a file." }, { status: 401 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = parseSellRequest(payload);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const db = await getDBFromContext();
  const viewer = await getMarketViewer(db, userId);
  if (!viewer) return NextResponse.json({ error: "Sign in to sell a file." }, { status: 401 });
  if (viewer.isAnonymous) {
    return NextResponse.json({ error: "Create an account to sell files." }, { status: 403 });
  }

  let outline = parsed.value.outline;
  if (!outline) {
    const [doc] = await db
      .select({ content: documents.content, format: documents.format })
      .from(documents)
      .where(and(eq(documents.id, parsed.value.documentId), eq(documents.userId, userId)))
      .limit(1);
    outline = doc && doc.format !== "cmir" ? outlineFromHtml(doc.content) : [];
  }

  let id: string;
  try {
    id = await upsertListing(db, {
      sellerId: userId,
      documentId: parsed.value.documentId,
      priceCents: parsed.value.priceCents,
      outline,
    });
  } catch (error) {
    if (error instanceof PurchaseRefused) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const listing = await getListing(db, id, userId);
  const { content: _content, ...withoutContent } = listing!;
  const body: SellResult = { listing: withoutContent };
  return NextResponse.json(body, { status: 201 });
});
