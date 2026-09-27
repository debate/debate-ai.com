import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { authorizeCardImport } from "@/lib/admin/debate-card-import";
import { getDBFromContext } from "@/lib/database/context";
import { detectedUrls, user } from "@/lib/database/schema";

const DEFAULT_PAGE_ROWS = 50;
const MAX_PAGE_ROWS = 200;

export async function GET(request: NextRequest) {
  const access = await authorizeCardImport(request);
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(MAX_PAGE_ROWS, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_PAGE_ROWS));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const search = searchParams.get("search")?.trim() || "";
  const userId = searchParams.get("userId")?.trim() || "";
  const sinceDays = searchParams.get("sinceDays") ? Math.max(1, Number(searchParams.get("sinceDays"))) : null;

  const db = await getDBFromContext();

  const whereConditions: any[] = [];
  if (search) {
    whereConditions.push(sql`(${detectedUrls.url} LIKE ${"%" + search + "%"} OR ${detectedUrls.title} LIKE ${"%" + search + "%"})`);
  }
  if (userId) {
    whereConditions.push(eq(detectedUrls.userId, userId));
  }
  if (sinceDays) {
    const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
    whereConditions.push(gt(detectedUrls.lastVisitedAt, cutoff));
  }

  const [rows, total] = await Promise.all([
    db
      .select({
        id: detectedUrls.id,
        userId: detectedUrls.userId,
        url: detectedUrls.url,
        normalizedUrl: detectedUrls.normalizedUrl,
        title: detectedUrls.title,
        favicon: detectedUrls.favicon,
        visitCount: detectedUrls.visitCount,
        lastVisitedAt: detectedUrls.lastVisitedAt,
        createdAt: detectedUrls.createdAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(detectedUrls)
      .leftJoin(user, eq(detectedUrls.userId, user.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(detectedUrls.lastVisitedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(detectedUrls)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined),
  ]);

  return NextResponse.json({
    urls: rows,
    total: total[0]?.count || 0,
    limit,
    offset,
  });
}