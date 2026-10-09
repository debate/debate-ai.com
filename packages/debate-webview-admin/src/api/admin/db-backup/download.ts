import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { backupFileName, backupSqlStream, parseBackupGroups, type BackupDb } from "@/lib/admin/db-backup";
import { zipSingleFileStream } from "@/lib/admin/zip";

/**
 * Streams a fresh SQL dump of the content tables straight to the browser,
 * zipped in the worker on the way out. `?groups=videos,cards,history` picks the
 * groups (all by default); `?format=sql` sends the dump uncompressed instead.
 * Nothing is stored — use POST /api/admin/db-backup to keep a copy in R2.
 */
export async function GET(request: Request) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const groups = parseBackupGroups(params.get("groups"));
  const db = (await getDBFromContext()) as unknown as BackupDb;
  const now = new Date();
  const sql = backupSqlStream(db, groups);

  if (params.get("format") === "sql") {
    return new Response(sql, {
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="${backupFileName(now, "sql")}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(zipSingleFileStream(backupFileName(now, "sql"), sql, now), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${backupFileName(now, "zip")}"`,
      "Cache-Control": "no-store",
    },
  });
}