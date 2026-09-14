/**
 * Public search endpoint for the imported debate-card corpus.
 *
 * The admin Parquet importer writes normalized rows to `debate_cards`.  This
 * route is deliberately the other half of that feature: `/cards` reads those
 * rows directly instead of falling back to a separate in-memory demo corpus.
 */
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { debateCards } from "@/lib/database/schema";

/** Keeping a search response bounded makes it safe for a large D1 corpus. */
const RESULT_LIMIT = 100;
const MAX_QUERY_LENGTH = 500;

/** Escape LIKE metacharacters; typed `%` and `_` must stay literal. */
function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

function contains(column: any, query: string) {
  return sql`lower(${column}) LIKE ${likePattern(query)} ESCAPE '\\'`;
}

/** Turns a stored Parquet row into the shape consumed by the cards UI. */
function toSearchResult(card: typeof debateCards.$inferSelect) {
  const outline = [card.pocket, card.hat, card.block].filter(Boolean).join(" · ");
  const text = card.fulltext || card.spoken || card.summary;
  return {
    id: card.id,
    category: card.side === "A" ? "AFF" : card.side === "N" ? "NEG" : card.side,
    researchField: card.caselistDisplayName,
    readCount: card.duplicateCount,
    word_count: card.textLength > 0 ? Math.ceil(card.textLength / 5) : text.trim().split(/\s+/).filter(Boolean).length,
    argBlock: outline,
    summary: card.summary || card.spoken || text.slice(0, 400),
    tag: card.tag,
    cite_short: card.cite,
    cite: card.fullcite || card.cite,
    // The dump does not expose a separate highlighted-character count. The
    // markup is still rendered in the reader, and a zero here suppresses a
    // misleading highlight-ratio badge in the result list.
    highlightLength: 0,
    textLength: card.textLength || text.length,
    html: card.markup || text,
    year: card.year ? String(card.year) : "",
    page: "",
    school: card.caselistDisplayName,
    team: "",
    side: card.side,
    tournament: card.event,
    round: "",
    event: card.event,
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = (params.get("q") ?? "").trim().toLowerCase().slice(0, MAX_QUERY_LENGTH);
  const filters: any[] = [];

  const year = Number.parseInt(params.get("year") ?? "", 10);
  if (Number.isInteger(year)) filters.push(eq(debateCards.year, year));
  const event = (params.get("event") ?? "").trim().toLowerCase();
  if (event && event !== "all") filters.push(eq(debateCards.event, event));

  for (const key of ["school", "team", "tournament"] as const) {
    const value = (params.get(key) ?? "").trim().toLowerCase();
    // Parquet supplies a caselist name, not separate school/team/tournament
    // columns. Searching it keeps the existing controls useful without
    // inventing provenance that the source data did not contain.
    if (value) filters.push(contains(debateCards.caselistDisplayName, value));
  }

  if (query) {
    const requestedScopes = [
      ["searchHighlighted", [debateCards.markup]],
      ["searchUnderlined", [debateCards.markup]],
      ["searchSummaries", [debateCards.summary]],
      ["searchOutlines", [debateCards.tag, debateCards.pocket, debateCards.hat, debateCards.block]],
      ["searchRoundSpeeches", [debateCards.spoken]],
      ["searchQuotes", [debateCards.cite, debateCards.fullcite]],
    ] as const;
    const scopedColumns = requestedScopes
      .filter(([flag]) => params.get(flag) === "1")
      .flatMap(([, columns]) => columns);
    const columns = params.get("searchAllText") === "1" || scopedColumns.length === 0
      ? [debateCards.tag, debateCards.cite, debateCards.fullcite, debateCards.summary, debateCards.spoken, debateCards.fulltext, debateCards.markup, debateCards.pocket, debateCards.hat, debateCards.block, debateCards.caselistDisplayName]
      : scopedColumns;
    filters.push(or(...columns.map((column) => contains(column, query))));
  }

  const where = filters.length ? and(...filters) : undefined;
  const db = await getDBFromContext();
  const sort = params.get("sort") ?? "_text_match:desc";
  const orderBy = sort === "year:asc" ? asc(debateCards.year)
    : sort === "year:desc" ? desc(debateCards.year)
    : sort === "readCount:desc" ? desc(debateCards.duplicateCount)
    : sort === "highlightLength:asc" ? asc(debateCards.textLength)
    : sort === "highlightLength:desc" ? desc(debateCards.textLength)
    : desc(debateCards.importedAt);

  const [rows, totals] = await Promise.all([
    db.select().from(debateCards).where(where).orderBy(orderBy).limit(RESULT_LIMIT),
    db.select({ total: sql<number>`count(*)` }).from(debateCards).where(where),
  ]);

  return NextResponse.json({ results: rows.map(toSearchResult), total: Number(totals[0]?.total ?? 0) });
}
