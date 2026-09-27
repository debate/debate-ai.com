import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { authorizeCardImport } from "@/lib/admin/debate-card-import";
import { getDBFromContext } from "@/lib/database/context";
import { detectedUrls } from "@/lib/database/schema";

export async function GET(request: NextRequest) {
  const access = await authorizeCardImport(request);
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const sinceDays = searchParams.get("sinceDays") ? Math.max(1, Number(searchParams.get("sinceDays"))) : 30;

  const db = await getDBFromContext();
  const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const whereCondition = gt(detectedUrls.lastVisitedAt, cutoff);

  const [totalUrls, uniqueUsers, totalVisits, topUrls] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(detectedUrls)
      .where(whereCondition),
    db
      .select({ count: sql<number>`count(distinct ${detectedUrls.userId})` })
      .from(detectedUrls)
      .where(whereCondition),
    db
      .select({ count: sql<number>`sum(${detectedUrls.visitCount})` })
      .from(detectedUrls)
      .where(whereCondition),
    db
      .select({
        url: detectedUrls.url,
        title: detectedUrls.title,
        visitCount: detectedUrls.visitCount,
        lastVisitedAt: detectedUrls.lastVisitedAt,
      })
      .from(detectedUrls)
      .where(whereCondition)
      .orderBy(desc(detectedUrls.visitCount))
      .limit(10),
  ]);

  return NextResponse.json({
    totalUrls: totalUrls[0]?.count || 0,
    uniqueUsers: uniqueUsers[0]?.count || 0,
    totalVisits: totalVisits[0]?.count || 0,
    topUrls: topUrls,
    periodDays: sinceDays,
  });
}