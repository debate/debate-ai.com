import { NextResponse } from "next/server";
import { count, desc } from "drizzle-orm";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { documents, session, user, videos, youtubeRoundVideos } from "@/lib/database/schema";

/** Compact administrative telemetry; no private session tokens are exposed. */
export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const db = await getDBFromContext();
  const [[users], [sessions], [files], [publishedVideos], [stagedVideos], recentUsers] = await Promise.all([
    db.select({ value: count() }).from(user), db.select({ value: count() }).from(session),
    db.select({ value: count() }).from(documents), db.select({ value: count() }).from(videos),
    db.select({ value: count() }).from(youtubeRoundVideos),
    db.select({ id: user.id, name: user.name, email: user.email, image: user.image, createdAt: user.createdAt, isAnonymous: user.isAnonymous }).from(user).orderBy(desc(user.createdAt)).limit(12),
  ]);
  return NextResponse.json({ stats: { users: users?.value ?? 0, sessions: sessions?.value ?? 0, files: files?.value ?? 0, publishedVideos: publishedVideos?.value ?? 0, stagedVideos: stagedVideos?.value ?? 0 }, recentUsers });
}
