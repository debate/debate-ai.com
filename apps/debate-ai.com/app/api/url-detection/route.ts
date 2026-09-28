import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDBFromContext } from "@/lib/database/context";
import { detectedUrls, user } from "@/lib/database/schema";

const MAX_FIELD_LENGTH = 2048;

function normalizeSourceUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

export async function POST(req: NextRequest) {
  let body: Partial<{
    url: string;
    title: string;
    favicon: string;
  }>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const title = typeof body.title === "string" ? body.title.slice(0, MAX_FIELD_LENGTH) : null;
  const favicon = typeof body.favicon === "string" ? body.favicon.slice(0, MAX_FIELD_LENGTH) : null;

  if (!url) {
    return NextResponse.json({ error: "url is required." }, { status: 400 });
  }

  const normalizedUrl = normalizeSourceUrl(url);
  if (!normalizedUrl) {
    return NextResponse.json({ error: "url must be non-empty after normalization." }, { status: 400 });
  }

  const db = await getDBFromContext();

  const result = await db
    .insert(detectedUrls)
    .values({
      userId: "anonymous",
      url: url.slice(0, MAX_FIELD_LENGTH),
      normalizedUrl,
      title,
      favicon,
      visitCount: 1,
      lastVisitedAt: sql`(unixepoch())`,
    })
    .onConflictDoUpdate({
      target: [detectedUrls.userId, detectedUrls.normalizedUrl],
      set: {
        url: sql`excluded.url`,
        title: sql`excluded.title`,
        favicon: sql`excluded.favicon`,
        visitCount: sql`${detectedUrls.visitCount} + 1`,
        lastVisitedAt: sql`(unixepoch())`,
      },
    })
    .returning({ id: detectedUrls.id, visitCount: detectedUrls.visitCount });

  return NextResponse.json(
    { id: result[0]?.id, visitCount: result[0]?.visitCount },
    { status: 201 },
  );
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const userId = searchParams.get("userId") || "anonymous";
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const search = searchParams.get("search")?.trim() || "";

  const db = await getDBFromContext();

  const whereConditions = [eq(detectedUrls.userId, userId)];
  if (search) {
    whereConditions.push(sql`(${detectedUrls.url} LIKE ${"%" + search + "%"} OR ${detectedUrls.title} LIKE ${"%" + search + "%"})`);
  }

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(detectedUrls)
      .where(and(...whereConditions))
      .orderBy(desc(detectedUrls.lastVisitedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(detectedUrls)
      .where(and(...whereConditions)),
  ]);

  return NextResponse.json({
    urls: rows,
    total: total[0]?.count || 0,
    limit,
    offset,
  });
}