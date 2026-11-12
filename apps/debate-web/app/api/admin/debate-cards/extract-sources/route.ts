/**
 * @fileoverview Admin endpoint behind the "Original sources" panel: finds and
 * extracts the original source text of each parsed card, from its cited URL
 * or, failing that, the best QwkSearch match for its citation
 * (`lib/admin/card-source-extraction.ts`).
 *
 * `GET ?year=&event=` → the progress chart's counts
 * (`{ total, withUrl, extracted, viaCite, viaSearch, notFound, failed, years, events }`).
 *
 * `POST { afterId?, limit?, year?, event?, retryFailed? }` → one page
 * (`{ processed, extracted, viaCite, viaSearch, notFound, failed, results, nextAfterId, done }`).
 * Cards already handled are skipped, so the caller can stop at any time and
 * start again from 0.
 *
 * QwkSearch is reached at `QWKSEARCH_ORIGIN` (default qwksearch.com), with
 * `QWKSEARCH_API_KEY` as a bearer key when set.
 *
 * @module app/api/admin/debate-cards/extract-sources/route
 */
import { NextRequest, NextResponse } from "next/server";
import { qwksearchOrigin } from "@debate-ai/qwksearch/lib/connect";
import { authorizeCardImport } from "@/lib/admin/debate-card-import";
import {
  extractCardSourcesPage,
  qwkSearchClient,
  readCardSourceStats,
} from "@/lib/admin/card-source-extraction";
import { getDBFromContext } from "@/lib/database/context";
import { getEnv } from "@/lib/env";
import { getCardTextBucket } from "@/lib/search/card-text-store";

/** Each card can take a search plus several extractions, so pages are small. */
const DEFAULT_PAGE_ROWS = 6;
const MAX_PAGE_ROWS = 20;

function parseFilter(year: unknown, event: unknown) {
  const y = Math.trunc(Number(year) || 0);
  const e = typeof event === "string" ? event.trim().slice(0, 32) : "";
  return { year: y > 0 ? y : undefined, event: e || undefined };
}

export async function GET(request: NextRequest) {
  const access = await authorizeCardImport(request);
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = request.nextUrl.searchParams;
  try {
    const db = await getDBFromContext();
    const stats = await readCardSourceStats(db, parseFilter(params.get("year"), params.get("event")));
    return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("extract-sources: stats failed", error);
    return NextResponse.json(
      { error: "Failed to count card sources.", details: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await authorizeCardImport(request);
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const bucket = getCardTextBucket();
  if (!bucket) {
    return NextResponse.json(
      { error: "Original sources are stored in the CARD_TEXT R2 bucket, which this deployment has not bound." },
      { status: 503 },
    );
  }

  let body: { afterId?: unknown; limit?: unknown; year?: unknown; event?: unknown; retryFailed?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // An empty body starts from the beginning with the defaults.
  }
  const afterId = Math.max(0, Math.trunc(Number(body.afterId) || 0));
  const limit = Math.min(MAX_PAGE_ROWS, Math.max(1, Math.trunc(Number(body.limit) || DEFAULT_PAGE_ROWS)));

  try {
    const db = await getDBFromContext();
    const qwk = qwkSearchClient(qwksearchOrigin(getEnv("QWKSEARCH_ORIGIN")), {
      apiKey: getEnv("QWKSEARCH_API_KEY")?.trim() || undefined,
    });
    const page = await extractCardSourcesPage(db, bucket, qwk, {
      afterId,
      limit,
      retryFailed: body.retryFailed === true,
      ...parseFilter(body.year, body.event),
    });
    return NextResponse.json(page);
  } catch (error) {
    console.error("extract-sources: page failed", error);
    return NextResponse.json(
      { error: "Failed to extract card sources.", details: (error as Error).message },
      { status: 500 },
    );
  }
}
