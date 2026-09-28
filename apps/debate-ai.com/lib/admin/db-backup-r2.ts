/**
 * @fileoverview Stores {@link generateBackupSql} dumps in R2.
 *
 * The bucket is bound as `DB_BACKUPS` in wrangler.jsonc. Objects are gzipped
 * (`.sql.gz`) and live under `db-backups/manual/` (the admin panel's "Save to
 * R2" button) or `db-backups/weekly/` (the cron). Only the weekly prefix is
 * pruned, to the newest {@link WEEKLY_BACKUPS_TO_KEEP}; manual backups stay
 * until an admin deletes them.
 *
 * The bucket is private. The link the admin panel shows is
 * `/api/admin/db-backup/file?key=…`, an admin-only route that streams the
 * object back — nothing here is ever given a public URL.
 *
 * R2's `put()` refuses a stream of unknown length, so the upload is multipart:
 * the gzip output is cut into {@link PART_SIZE} parts (R2 requires every part
 * but the last to be the same size) and nothing larger than one part is held
 * in memory.
 * @module lib/admin/db-backup-r2
 */

import { getCloudflareContext } from "../database/context";
import {
  backupFileName,
  emptyBackupStats,
  generateBackupSql,
  type BackupDb,
  type BackupGroup,
  type BackupStats,
} from "./db-backup";

export const BACKUP_PREFIX = "db-backups/";
export const WEEKLY_BACKUPS_TO_KEEP = 12;
/** 10 MiB — above R2's 5 MiB minimum part size. */
export const PART_SIZE = 10 * 1024 * 1024;

export type BackupTrigger = "manual" | "weekly";

/** The slice of the R2 binding this module uses. */
export interface R2ObjectLike {
  key: string;
  size: number;
  uploaded: Date;
  customMetadata?: Record<string, string>;
}
export interface R2ObjectBodyLike extends R2ObjectLike {
  body: ReadableStream<Uint8Array>;
  httpMetadata?: { contentType?: string };
}
export interface R2UploadedPartLike {
  partNumber: number;
  etag: string;
}
export interface R2MultipartUploadLike {
  uploadPart(partNumber: number, value: Uint8Array): Promise<R2UploadedPartLike>;
  complete(parts: R2UploadedPartLike[]): Promise<R2ObjectLike>;
  abort(): Promise<void>;
}
export interface R2BucketLike {
  createMultipartUpload(
    key: string,
    options?: { httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> },
  ): Promise<R2MultipartUploadLike>;
  get(key: string): Promise<R2ObjectBodyLike | null>;
  head(key: string): Promise<R2ObjectLike | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number; include?: string[] }): Promise<{
    objects: R2ObjectLike[];
    truncated: boolean;
    cursor?: string;
  }>;
}

/** The `DB_BACKUPS` binding of the current request/cron, or null when it is not bound. */
export function getBackupBucket(): R2BucketLike | null {
  const bucket = getCloudflareContext()?.env?.DB_BACKUPS as R2BucketLike | undefined;
  return bucket && typeof bucket.createMultipartUpload === "function" ? bucket : null;
}

/** True for a key this feature wrote — the file route serves nothing else. */
export function isBackupKey(key: string): boolean {
  return key.startsWith(BACKUP_PREFIX) && !key.includes("..") && /\.sql(\.gz)?$/.test(key);
}

/** The admin-only link that downloads a stored backup. */
export function backupFileUrl(key: string): string {
  return `/api/admin/db-backup/file?key=${encodeURIComponent(key)}`;
}

/** Collects byte chunks into fixed-size parts. */
class PartBuffer {
  private chunks: Uint8Array[] = [];
  private length = 0;

  constructor(private readonly size: number) {}

  push(chunk: Uint8Array): Uint8Array[] {
    this.chunks.push(chunk);
    this.length += chunk.byteLength;
    const full: Uint8Array[] = [];
    while (this.length >= this.size) full.push(this.take(this.size));
    return full;
  }

  rest(): Uint8Array | null {
    return this.length > 0 ? this.take(this.length) : null;
  }

  private take(count: number): Uint8Array {
    const out = new Uint8Array(count);
    let offset = 0;
    while (offset < count) {
      const head = this.chunks[0];
      const needed = count - offset;
      if (head.byteLength <= needed) {
        out.set(head, offset);
        offset += head.byteLength;
        this.chunks.shift();
      } else {
        out.set(head.subarray(0, needed), offset);
        this.chunks[0] = head.subarray(needed);
        offset += needed;
      }
    }
    this.length -= count;
    return out;
  }
}

/**
 * Gzips a stream of text chunks into one R2 object via multipart upload.
 * Aborts the upload on any failure so no half-written object is left behind.
 */
export async function uploadGzippedText(
  bucket: R2BucketLike,
  key: string,
  chunks: AsyncIterable<string>,
  customMetadata: Record<string, string> = {},
  partSize: number = PART_SIZE,
): Promise<R2ObjectLike> {
  const upload = await bucket.createMultipartUpload(key, {
    httpMetadata: { contentType: "application/gzip" },
    customMetadata,
  });

  const gzip = new CompressionStream("gzip");
  const writer = gzip.writable.getWriter();
  const encoder = new TextEncoder();
  // Feed the compressor concurrently with reading its output, or its
  // backpressure would stall both sides.
  const feeding = (async () => {
    try {
      for await (const chunk of chunks) await writer.write(encoder.encode(chunk));
      await writer.close();
    } catch (error) {
      await writer.abort(error).catch(() => {});
      throw error;
    }
  })();

  try {
    const parts: R2UploadedPartLike[] = [];
    const buffer = new PartBuffer(partSize);
    const reader = gzip.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const part of buffer.push(value)) parts.push(await upload.uploadPart(parts.length + 1, part));
    }
    await feeding;
    const last = buffer.rest();
    // An empty object still needs one part to complete.
    if (last || parts.length === 0) parts.push(await upload.uploadPart(parts.length + 1, last ?? new Uint8Array(0)));
    return await upload.complete(parts);
  } catch (error) {
    await feeding.catch(() => {});
    await upload.abort().catch(() => {});
    throw error;
  }
}

export interface StoredBackup {
  key: string;
  fileName: string;
  size: number;
  uploaded: string;
  trigger: BackupTrigger | "unknown";
  groups: string | null;
  url: string;
}

function toStoredBackup(object: R2ObjectLike): StoredBackup {
  const meta = object.customMetadata ?? {};
  const trigger = meta.trigger === "manual" || meta.trigger === "weekly" ? meta.trigger : "unknown";
  return {
    key: object.key,
    fileName: object.key.split("/").pop() ?? object.key,
    size: object.size,
    uploaded: new Date(object.uploaded).toISOString(),
    trigger,
    groups: meta.groups ?? null,
    url: backupFileUrl(object.key),
  };
}

/** Every stored backup, newest first. */
export async function listBackups(bucket: R2BucketLike, prefix: string = BACKUP_PREFIX): Promise<StoredBackup[]> {
  const objects: R2ObjectLike[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor, include: ["customMetadata"] });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects.map(toStoredBackup).sort((a, b) => b.uploaded.localeCompare(a.uploaded));
}

export interface BackupResult {
  backup: StoredBackup;
  stats: BackupStats;
  pruned: string[];
}

/**
 * Dumps the chosen groups into a new R2 object. A weekly run then prunes the
 * weekly prefix to the newest {@link WEEKLY_BACKUPS_TO_KEEP}.
 */
export async function createR2Backup(
  db: BackupDb,
  bucket: R2BucketLike,
  groups: readonly BackupGroup[],
  trigger: BackupTrigger,
  now: Date = new Date(),
): Promise<BackupResult> {
  const stats = emptyBackupStats();
  const key = `${BACKUP_PREFIX}${trigger}/${backupFileName(now, "sql.gz")}`;
  // customMetadata is fixed when the upload starts, before the rows are
  // counted, so row counts come back in `stats` rather than on the object.
  const object = await uploadGzippedText(bucket, key, generateBackupSql(db, groups, stats, now), {
    trigger,
    groups: groups.join(","),
  });

  const backup = { ...toStoredBackup(object), trigger, groups: groups.join(",") };

  let pruned: string[] = [];
  if (trigger === "weekly") {
    // Keys carry an ISO timestamp, so sorting them newest-first is exact.
    const weekly = (await listBackups(bucket, `${BACKUP_PREFIX}weekly/`)).map((item) => item.key).sort().reverse();
    pruned = weekly.slice(WEEKLY_BACKUPS_TO_KEEP);
    if (pruned.length > 0) await bucket.delete(pruned);
  }

  return { backup, stats, pruned };
}
