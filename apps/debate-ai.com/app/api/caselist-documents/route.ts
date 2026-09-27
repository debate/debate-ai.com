import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { caselistDocuments } from "@/lib/database/schema";
import { eq, and, ilike, desc, sql } from "drizzle-orm";

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

  const conditions = [];
  if (school) conditions.push(ilike(caselistDocuments.school, school));
  if (team) conditions.push(ilike(caselistDocuments.team, team));
  if (caselistSlug) conditions.push(eq(caselistDocuments.caselistSlug, caselistSlug));

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

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