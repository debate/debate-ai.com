import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { backupFileName, backupSqlStream, parseBackupGroups, type BackupDb } from "@/lib/admin/db-backup";

/**
 * Streams a fresh SQL dump of the content tables straight to the browser.
 * `?groups=videos,cards,history` picks the groups (all by default). Nothing
 * is stored — use POST /api/admin/db-backup to keep a copy in R2.
 */
export async function GET(request: Request) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const groups = parseBackupGroups(new URL(request.url).searchParams.get("groups"));
  const db = (await getDBFromContext()) as unknown as BackupDb;

  return new Response(backupSqlStream(db, groups), {
    headers: {
      "Content-Type": "application/sql; charset=utf-8",
      "Content-Disposition": `attachment; filename="${backupFileName()}"`,
      "Cache-Control": "no-store",
    },
  });
}
