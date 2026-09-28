/**
 * @fileoverview The weekly content backup behind its own cron trigger.
 *
 * `wrangler.jsonc` schedules {@link DB_BACKUP_CRON} alongside the YouTube
 * sync's tick; the `scheduled` export in `worker/index.ts` tells the two apart
 * by `event.cron` and hands this one here. It runs on a different hour than
 * the sync so the two never share one invocation's CPU budget, and before it,
 * so a backup never captures a half-finished sync.
 *
 * The dump covers every group in lib/admin/db-backup.ts (videos, cards,
 * history) and lands under `db-backups/weekly/` in the `DB_BACKUPS` bucket,
 * which is then pruned to the newest few — see lib/admin/db-backup-r2.ts.
 * @module lib/admin/weekly-db-backup
 */

import { getDBFromContext } from "../database/context";
import { BACKUP_GROUPS, type BackupDb } from "./db-backup";
import { createR2Backup, getBackupBucket, type BackupResult } from "./db-backup-r2";

/** Sundays at 07:00 UTC. Must match the entry in wrangler.jsonc's `triggers.crons`. */
export const DB_BACKUP_CRON = "0 7 * * 0";

/** Runs one weekly backup. Returns null (and logs) when no bucket is bound. */
export async function runWeeklyDbBackup(now: Date = new Date()): Promise<BackupResult | null> {
  const bucket = getBackupBucket();
  if (!bucket) {
    console.warn("Weekly DB backup skipped: no R2 bucket bound as DB_BACKUPS.");
    return null;
  }
  const db = (await getDBFromContext()) as unknown as BackupDb;
  const result = await createR2Backup(db, bucket, BACKUP_GROUPS, "weekly", now);
  console.log(
    `Weekly DB backup stored ${result.backup.key} (${result.backup.size} bytes, ${result.stats.totalRows} rows` +
      `${result.stats.missing.length ? `, missing tables: ${result.stats.missing.join(", ")}` : ""}` +
      `${result.pruned.length ? `, pruned ${result.pruned.length} old backups` : ""}).`,
  );
  return result;
}
