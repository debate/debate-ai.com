import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import {
  BACKUP_GROUP_LABELS,
  BACKUP_GROUPS,
  BACKUP_TABLES,
  parseBackupGroups,
  type BackupDb,
} from "@/lib/admin/db-backup";
import {
  createR2Backup,
  getBackupBucket,
  getBackupKv,
  listBackups,
  SEVEN_ZIP_MAX_BYTES,
  WEEKLY_BACKUPS_TO_KEEP,
} from "@/lib/admin/db-backup-r2";

/**
 * Content-table SQL backups (lib/admin/db-backup.ts).
 *
 * GET  — what a backup contains, whether R2 is bound, and the backups stored there.
 * POST — `{ groups?: string[] }`: dump those groups into a new R2 object (and
 *        a `.sql.7z` copy into the DB_BACKUPS_KV namespace, when bound) and
 *        return their download links.
 *
 * The plain download lives at ./download, the stored files at ./file.
 */
export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bucket = getBackupBucket();
  const kv = getBackupKv();
  let backups: Awaited<ReturnType<typeof listBackups>> = [];
  let listError: string | null = null;
  if (bucket) {
    try {
      backups = await listBackups(bucket, undefined, kv);
    } catch (error) {
      console.error("Error listing R2 backups:", error);
      listError = describeError(error);
    }
  }

  return NextResponse.json({
    groups: BACKUP_GROUPS.map((group) => ({
      key: group,
      label: BACKUP_GROUP_LABELS[group],
      tables: BACKUP_TABLES.filter((table) => table.group === group).map((table) => ({
        name: table.name,
        scrubbed: Object.keys(table.scrub ?? {}),
      })),
    })),
    r2Configured: Boolean(bucket),
    kvConfigured: Boolean(kv),
    sevenZipMaxBytes: SEVEN_ZIP_MAX_BYTES,
    weeklyBackupsKept: WEEKLY_BACKUPS_TO_KEEP,
    backups,
    listError,
  });
}

export async function POST(request: Request) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bucket = getBackupBucket();
  if (!bucket) {
    return NextResponse.json(
      { error: "R2 is not configured", details: "Bind an R2 bucket as DB_BACKUPS in wrangler.jsonc." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { groups?: unknown };
  const groups = parseBackupGroups(Array.isArray(body.groups) ? body.groups.map(String) : null);

  try {
    const db = (await getDBFromContext()) as unknown as BackupDb;
    const result = await createR2Backup(db, bucket, groups, "manual", new Date(), getBackupKv());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error creating R2 backup:", error);
    return NextResponse.json({ error: "Backup failed", details: describeError(error) }, { status: 500 });
  }
}
