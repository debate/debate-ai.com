import { type NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { debateCards } from "@/lib/database/schema";
import { desc, sql, and, or, like, ilike } from "drizzle-orm";

function extractTagText(html: string, tag: string): string {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, "gi");
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    matches.push(match[1].replace(/<[^>]*>/g, ""));
  }
  return matches.join(" ").toLowerCase();
}

function mapDebateCardToSearchResult(card: any): any {
  const pocket = card.pocket || "";
  const hat = card.hat || "";
  const block = card.block || "";
  const argBlock = [pocket, hat, block].filter(Boolean).join(" > ") || card.tag || "Untitled";

  const fulltext = card.fulltext || "";
  const markup = card.markup || "";
  const html = markup || fulltext || "";

  const wordCount = card.textLength > 0 ? Math.round(card.textLength / 5) : 0;
  const highlightLength = (markup.match(/<mark>/gi) || []).length * 50;

  const citeShort = card.cite
    ? card.cite.split(".")[0]?.substring(0, 80) || card.cite.substring(0, 80)
    : "";

  const caselist = card.caselistDisplayName || "";
  const school = caselist || "Unknown";
  const tournament = caselist || "Unknown";

  const categoryMap: Record<string, string> = {
    DA: "DA",
    CP: "CP",
    K: "K",
    I: "I",
    T: "T",
    AFF: "I",
    NEG: "DA",
  };
  const category = pocket ? categoryMap[pocket.toUpperCase()] || "DA" : "DA";

  return {
    id: card.id,
    category,
    researchField: pocket || "General",
    argBlock,
    summary: card.summary || card.spoken || fulltext.substring(0, 200) || "",
    cite_short: citeShort,
    cite: card.cite || card.fullcite || "",
    readCount: 0,
    highlightLength,
    textLength: card.textLength || 0,
    word_count: wordCount,
    html,
    tag: card.tag || "",
    year: String(card.year || ""),
    page: "",
    school,
    team: "",
    side: card.side || "",
    tournament,
    round: "",
    event: card.event || "CX",
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sortBy = searchParams.get("sort") || "_text_match:desc";
  const query = searchParams.get("q") || "";

  const yearFilter = searchParams.get("year") || "";
  const schoolFilter = searchParams.get("school") || "";
  const teamFilter = searchParams.get("team") || "";
  const tournamentFilter = searchParams.get("tournament") || "";
  const eventFilter = searchParams.get("event") || "";

  const searchHighlighted = searchParams.get("searchHighlighted") === "1";
  const searchUnderlined = searchParams.get("searchUnderlined") === "1";
  const searchSummaries = searchParams.get("searchSummaries") === "1";
  const searchBlockAndFileTitles = searchParams.get("searchBlockAndFileTitles") === "1";
  const searchAllText = searchParams.get("searchAllText") === "1";
  const hasSearchScope =
    searchHighlighted ||
    searchUnderlined ||
    searchSummaries ||
    searchBlockAndFileTitles ||
    searchAllText;

  try {
    const db = await getDBFromContext();

    const conditions = [];

    if (query) {
      const lowerQuery = query.toLowerCase();
      const searchConditions = [];

      if (hasSearchScope && !searchAllText) {
        if (searchHighlighted) {
          searchConditions.push(ilike(debateCards.markup, `%<mark>%${lowerQuery}%</mark>%`));
        }
        if (searchUnderlined) {
          searchConditions.push(ilike(debateCards.markup, `%<u>%${lowerQuery}%</u>%`));
        }
        if (searchSummaries) {
          searchConditions.push(ilike(debateCards.summary, `%${lowerQuery}%`));
        }
        if (searchBlockAndFileTitles) {
          searchConditions.push(ilike(debateCards.pocket, `%${lowerQuery}%`));
          searchConditions.push(ilike(debateCards.hat, `%${lowerQuery}%`));
          searchConditions.push(ilike(debateCards.block, `%${lowerQuery}%`));
        }
      } else {
        searchConditions.push(ilike(debateCards.summary, `%${lowerQuery}%`));
        searchConditions.push(ilike(debateCards.fulltext, `%${lowerQuery}%`));
        searchConditions.push(ilike(debateCards.tag, `%${lowerQuery}%`));
        searchConditions.push(ilike(debateCards.pocket, `%${lowerQuery}%`));
        searchConditions.push(ilike(debateCards.hat, `%${lowerQuery}%`));
        searchConditions.push(ilike(debateCards.block, `%${lowerQuery}%`));
        searchConditions.push(ilike(debateCards.cite, `%${lowerQuery}%`));
        searchConditions.push(ilike(debateCards.fullcite, `%${lowerQuery}%`));
        searchConditions.push(ilike(debateCards.markup, `%${lowerQuery}%`));
      }

      if (searchConditions.length > 0) {
        conditions.push(or(...searchConditions));
      }
    }

    if (yearFilter) {
      const y = yearFilter.replace(/^20/, "");
      conditions.push(
        or(
          sql`CAST(${debateCards.year} AS TEXT) = ${y}`,
          sql`CAST(${debateCards.year} AS TEXT) = ${yearFilter}`,
        ),
      );
    }
    if (schoolFilter) {
      conditions.push(ilike(debateCards.caselistDisplayName, `%${schoolFilter}%`));
    }
    if (teamFilter) {
      conditions.push(sql`1=0`);
    }
    if (tournamentFilter) {
      conditions.push(ilike(debateCards.caselistDisplayName, `%${tournamentFilter}%`));
    }
    if (eventFilter && eventFilter !== "all") {
      conditions.push(sql`LOWER(${debateCards.event}) = LOWER(${eventFilter})`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const cards = await db
      .select()
      .from(debateCards)
      .where(whereClause)
      .limit(200);

    let results = cards.map(mapDebateCardToSearchResult);

    const [field, order] = sortBy.split(":");

    results.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (field) {
        case "readCount":
          aVal = a.readCount;
          bVal = b.readCount;
          break;
        case "year":
          aVal = Number.parseInt(a.year) || 0;
          bVal = Number.parseInt(b.year) || 0;
          break;
        case "highlightLength":
          aVal = a.highlightLength;
          bVal = b.highlightLength;
          break;
        case "_text_match":
        default:
          return 0;
      }

      if (order === "asc") {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });

    return NextResponse.json({ results, total: results.length });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ results: [], total: 0 });
  }
}
