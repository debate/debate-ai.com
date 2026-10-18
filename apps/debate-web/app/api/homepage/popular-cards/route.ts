import { NextResponse, type NextRequest } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { debateCards } from "@/lib/database/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

type CardFormat = "PF" | "LD" | "Policy";

function coerceFormat(event: string | null | undefined): CardFormat {
  const value = (event ?? "").toUpperCase();
  if (value === "PF") return "PF";
  if (value === "LD") return "LD";
  if (value === "POLICY" || value === "CX") return "Policy";
  return "Policy";
}

export async function GET(request: NextRequest) {
  const db = await getDBFromContext();
  const { searchParams } = new URL(request.url);
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 10;

  let rows: Array<{
    id: number;
    tag: string;
    event: string | null;
    caselistDisplayName: string;
    duplicateCount: number;
  }> = [];
  try {
    rows = await db
      .select({
        id: debateCards.id,
        tag: debateCards.tag,
        event: debateCards.event,
        caselistDisplayName: debateCards.caselistDisplayName,
        duplicateCount: debateCards.duplicateCount,
      })
      .from(debateCards)
      .orderBy(desc(debateCards.duplicateCount))
      .limit(limit);
  } catch (error) {
    console.error("homepage: popular cards query failed", error);
    return NextResponse.json([]);
  }

  return NextResponse.json(
    rows.map((row) => ({
      id: String(row.id),
      title: row.tag,
      topic: row.caselistDisplayName || "General",
      format: coerceFormat(row.event),
      reads: row.duplicateCount,
      href: "/research/cards",
    }))
  );
}
