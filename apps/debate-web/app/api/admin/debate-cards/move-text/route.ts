/**
 * @fileoverview Admin endpoint behind the panel's "Move card text to R2"
 * button: copies the full text and markup of cards imported before the R2
 * split from D1 into the `CARD_TEXT` bucket, then empties those D1 columns
 * (`lib/admin/card-text-migration.ts`). New imports already write there.
 *
 * `POST { kind?: "cards" | "caselist-docs", afterId?: number, limit?: number }`
 * → `{ moved, charsFreed, nextAfterId, done }`. Each call handles one page;
 * the caller loops until `done`. `kind: "caselist-docs"` moves the HTML of
 * the caselist speech documents card search lists as Outlines instead.
 *
 * @module app/api/admin/debate-cards/move-text/route
 */
import { NextRequest, NextResponse } from "next/server";
import { authorizeCardImport } from "@/lib/admin/debate-card-import";
import { moveCardTextPage, moveCaselistDocHtmlPage } from "@/lib/admin/card-text-migration";
import { getDBFromContext } from "@/lib/database/context";
import { getCardTextBucket } from "@/lib/search/card-text-store";

const DEFAULT_PAGE_ROWS = 200;
const MAX_PAGE_ROWS = 500;
/** A caselist document is a whole speech doc, often megabytes, so its pages are far smaller. */
const DEFAULT_DOC_PAGE_ROWS = 10;
const MAX_DOC_PAGE_ROWS = 25;

export async function POST(request: NextRequest) {
  const access = await authorizeCardImport(request);
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const bucket = getCardTextBucket();
  if (!bucket) {
    return NextResponse.json(
      { error: "Card text needs an R2 bucket bound as CARD_TEXT (see wrangler.jsonc)." },
      { status: 503 },
    );
  }

  let body: { kind?: unknown; afterId?: unknown; limit?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // An empty body starts from the beginning with the default page size.
  }
  const afterId = Math.max(0, Math.trunc(Number(body.afterId) || 0));
  const docs = body.kind === "caselist-docs";
  const limit = Math.min(
    docs ? MAX_DOC_PAGE_ROWS : MAX_PAGE_ROWS,
    Math.max(1, Math.trunc(Number(body.limit) || (docs ? DEFAULT_DOC_PAGE_ROWS : DEFAULT_PAGE_ROWS))),
  );

  try {
    const db = await getDBFromContext();
    const page = docs
      ? await moveCaselistDocHtmlPage(db, bucket, afterId, limit)
      : await moveCardTextPage(db, bucket, afterId, limit);
    return NextResponse.json(page);
  } catch (error) {
    console.error("move-text: page failed", error);
    return NextResponse.json(
      { error: "Failed to move card text.", details: (error as Error).message },
      { status: 500 },
    );
  }
}
