import { NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { caselistDocuments } from "@/lib/database/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const school = searchParams.get("school");
  const team = searchParams.get("team");
  const caselistSlug = searchParams.get("caselistSlug");
  const limit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
  const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);

  if (!school && !team) {
    return NextResponse.json(
      { error: "Either 'school' or 'team' query parameter is required" },
      { status: 400 },
    );
  }

  // Case-insensitive exact match. Not drizzle's `ilike`: it compiles to
  // Postgres' `ILIKE`, which D1/SQLite rejects as a syntax error, so every
  // request to this route returned a 500.
  const conditions = [];
  if (school) conditions.push(sql`${caselistDocuments.school} = ${school} COLLATE NOCASE`);
  if (team) conditions.push(sql`${caselistDocuments.team} = ${team} COLLATE NOCASE`);
  if (caselistSlug) conditions.push(eq(caselistDocuments.caselistSlug, caselistSlug));

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  const db = await getDBFromContext();

  const documents = await db
    .select({
      id: caselistDocuments.id,
      pathHash: caselistDocuments.pathHash,
      caselistSlug: caselistDocuments.caselistSlug,
      caselistLabel: caselistDocuments.caselistLabel,
      school: caselistDocuments.school,
      team: caselistDocuments.team,
      side: caselistDocuments.side,
      fileName: caselistDocuments.fileName,
      archivePath: caselistDocuments.archivePath,
      html: caselistDocuments.html,
      cardCount: caselistDocuments.cardCount,
      ingestedAt: caselistDocuments.ingestedAt,
      archiveDate: caselistDocuments.archiveDate,
    })
    .from(caselistDocuments)
    .where(whereClause)
    .orderBy(desc(caselistDocuments.ingestedAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(caselistDocuments)
    .where(whereClause);

  return NextResponse.json({
    documents,
    total: totalResult[0]?.count ?? 0,
    limit,
    offset,
  });
}