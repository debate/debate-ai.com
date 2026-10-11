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
 *
 * The dump is DEFLATE-compressed exactly once, by
 * {@link module:lib/admin/deflate}, and that one packed stream is what both
 * stores hold: the R2 object wraps it in a gzip member, and the `.sql.7z` copy
 * in the `DB_BACKUPS_KV` namespace uses the 7z format's Deflate coder
 * (lib/admin/seven-zip.ts) over the same bytes, keyed like the R2 object with
 * `.gz` swapped for `.7z`. Compressing it separately for each store is what
 * used to exhaust a Worker's CPU budget. A KV value is capped at
 * {@link SEVEN_ZIP_MAX_BYTES}; a dump that compresses past that keeps only its
 * R2 copy. The 7z copy is best effort — the R2 backup never fails because of it.
 * @module lib/admin/db-backup-r2
 */

import { getCloudflareContext } from "@/lib/database/context";
import {
  backupFileName,
  emptyBackupStats,
  generateBackupSql,
  type BackupDb,
  type BackupGroup,
  type BackupStats,
} from "./db-backup";
import { GZIP_HEADER, gzipTrailer, SharedDeflate, type DeflateSizes } from "./deflate";
import { SevenZipWriter } from "./seven-zip";

export const BACKUP_PREFIX = "db-backups/";
export const WEEKLY_BACKUPS_TO_KEEP = 12;
/** 10 MiB — above R2's 5 MiB minimum part size. */
export const PART_SIZE = 10 * 1024 * 1024;
/** Workers KV's largest value, 25 MiB. */
export const SEVEN_ZIP_MAX_BYTES = 25 * 1024 * 1024;

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

/** The slice of the KV binding this module uses. */
export interface SevenZipMetadata {
  size: number;
  uploaded: string;
}
export interface KVNamespaceLike {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { metadata?: SevenZipMetadata }): Promise<void>;
  get(key: string, type: "stream"): Promise<ReadableStream<Uint8Array> | null>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    keys: Array<{ name: string; metadata?: unknown }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

/** The `DB_BACKUPS_KV` binding that holds the `.sql.7z` copies, or null when it is not bound. */
export function getBackupKv(): KVNamespaceLike | null {
  const kv = getCloudflareContext()?.env?.DB_BACKUPS_KV as KVNamespaceLike | undefined;
  return kv && typeof kv.put === "function" && typeof kv.list === "function" ? kv : null;
}

/** The KV key of the 7z copy of an R2 backup (`….sql.gz` → `….sql.7z`). */
export function sevenZipKey(r2Key: string): string {
  return r2Key.replace(/\.sql(\.gz)?$/, ".sql.7z");
}

/** The `DB_BACKUPS` binding of the current request/cron, or null when it is not bound. */
export function getBackupBucket(): R2BucketLike | null {
  const bucket = getCloudflareContext()?.env?.DB_BACKUPS as R2BucketLike | undefined;
  return bucket && typeof bucket.createMultipartUpload === "function" ? bucket : null;
}

/** True for a key this feature wrote — the file route serves nothing else. */
export function isBackupKey(key: string): boolean {
  return key.startsWith(BACKUP_PREFIX) && !key.includes("..") && /\.sql(\.gz|\.7z)?$/.test(key);
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
 * Uploads one gzip member: a {@link GZIP_HEADER}, the DEFLATE stream in `packed`,
 * and the trailer R2's readers expect. Aborts the upload on any failure so no
 * half-written object is left behind.
 *
 * The Deflate stream is compressed by the caller and shared with the 7z copy,
 * so a backup is compressed once no matter how many copies of it are stored.
 * `sizes` is a function rather than a value because the CRC and the
 * uncompressed length are only final once `packed` has been read to its end.
 */
export async function uploadGzippedStream(
  bucket: R2BucketLike,
  key: string,
  packed: AsyncIterable<Uint8Array>,
  sizes: () => DeflateSizes,
  customMetadata: Record<string, string> = {},
  partSize: number = PART_SIZE,
): Promise<R2ObjectLike> {
  const upload = await bucket.createMultipartUpload(key, {
    httpMetadata: { contentType: "application/gzip" },
    customMetadata,
  });

  try {
    const parts: R2UploadedPartLike[] = [];
    const buffer = new PartBuffer(partSize);
    for (const part of buffer.push(GZIP_HEADER)) parts.push(await upload.uploadPart(parts.length + 1, part));
    for await (const chunk of packed) {
      for (const part of buffer.push(chunk)) parts.push(await upload.uploadPart(parts.length + 1, part));
    }
    const { crc, uncompressedSize } = sizes();
    for (const part of buffer.push(gzipTrailer(crc, uncompressedSize))) {
      parts.push(await upload.uploadPart(parts.length + 1, part));
    }
    const last = buffer.rest();
    // An empty object still needs one part to complete.
    if (last || parts.length === 0) parts.push(await upload.uploadPart(parts.length + 1, last ?? new Uint8Array(0)));
    return await upload.complete(parts);
  } catch (error) {
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
  /** The `.sql.7z` copy in KV, when there is one. */
  sevenZip: { key: string; size: number; url: string } | null;
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
    sevenZip: null,
  };
}

/** Every 7z copy in KV under `prefix`, by key. */
async function listSevenZips(kv: KVNamespaceLike, prefix: string): Promise<Map<string, number>> {
  const sizes = new Map<string, number>();
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix, cursor });
    for (const key of page.keys) sizes.set(key.name, Number((key.metadata as SevenZipMetadata | undefined)?.size) || 0);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return sizes;
}

/** Every stored backup, newest first, each with its 7z copy when `kv` has one. */
export async function listBackups(
  bucket: R2BucketLike,
  prefix: string = BACKUP_PREFIX,
  kv: KVNamespaceLike | null = null,
): Promise<StoredBackup[]> {
  const objects: R2ObjectLike[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor, include: ["customMetadata"] });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const sevenZips = kv ? await listSevenZips(kv, prefix) : new Map<string, number>();
  return objects
    .map((object) => {
      const backup = toStoredBackup(object);
      const key = sevenZipKey(object.key);
      const size = sevenZips.get(key);
      return size === undefined ? backup : { ...backup, sevenZip: { key, size, url: backupFileUrl(key) } };
    })
    .sort((a, b) => b.uploaded.localeCompare(a.uploaded));
}

/** Deletes R2 backups and their 7z copies in KV. */
export async function deleteBackups(bucket: R2BucketLike, keys: string[], kv: KVNamespaceLike | null = null): Promise<void> {
  if (keys.length === 0) return;
  await bucket.delete(keys);
  if (kv) await Promise.all(keys.map((key) => kv.delete(sevenZipKey(key))));
}

/** Feeds every chunk of the dump to `archive` on its way into the compressor. */
async function* encodeChunks(chunks: AsyncIterable<string>): AsyncGenerator<Uint8Array<ArrayBuffer>> {
  const encoder = new TextEncoder();
  for await (const chunk of chunks) yield encoder.encode(chunk);
}

/** Copies the packed stream into the 7z archive on its way to the R2 upload. */
async function* teePacked(
  packed: AsyncIterable<Uint8Array>,
  archive: SevenZipWriter | null,
): AsyncGenerator<Uint8Array> {
  for await (const chunk of packed) {
    // Past the KV limit the archive drops what it has and only counts.
    archive?.writePacked(chunk);
    yield chunk;
  }
}

export interface BackupResult {
  backup: StoredBackup;
  stats: BackupStats;
  pruned: string[];
  /** Why no 7z copy was stored in KV, when none was. */
  sevenZipSkipped: string | null;
}

/**
 * Dumps the chosen groups into a new R2 object — and, when `kv` is given, a
 * `.sql.7z` copy of the same dump into KV. A weekly run then prunes the
 * weekly prefix to the newest {@link WEEKLY_BACKUPS_TO_KEEP}.
 *
 * The dump is DEFLATE-compressed once ({@link module:lib/admin/deflate}) and the
 * packed stream feeds both stores: gzip for R2, the 7z coder for KV. Compressing
 * once and wrapping twice is what keeps a large dump inside the Worker's CPU
 * budget.
 */
export async function createR2Backup(
  db: BackupDb,
  bucket: R2BucketLike,
  groups: readonly BackupGroup[],
  trigger: BackupTrigger,
  now: Date = new Date(),
  kv: KVNamespaceLike | null = null,
  sevenZipMaxBytes: number = SEVEN_ZIP_MAX_BYTES,
): Promise<BackupResult> {
  const stats = emptyBackupStats();
  const key = `${BACKUP_PREFIX}${trigger}/${backupFileName(now, "sql.gz")}`;
  const archive = kv ? new SevenZipWriter(backupFileName(now, "sql"), sevenZipMaxBytes) : null;

  const deflate = new SharedDeflate();
  const packed = deflate.deflate(encodeChunks(generateBackupSql(db, groups, stats, now)));

  // customMetadata is fixed when the upload starts, before the rows are
  // counted, so row counts come back in `stats` rather than on the object.
  const object = await uploadGzippedStream(bucket, key, teePacked(packed, archive), () => deflate.sizes, {
    trigger,
    groups: groups.join(","),
  });

  const backup: StoredBackup = { ...toStoredBackup(object), trigger, groups: groups.join(",") };

  let sevenZipSkipped: string | null = kv ? null : "No KV namespace bound as DB_BACKUPS_KV.";
  if (kv && archive) {
    try {
      const bytes = archive.finish(deflate.sizes, now);
      if (!bytes) {
        sevenZipSkipped = `The 7z archive is larger than the ${Math.round(sevenZipMaxBytes / 1024 / 1024)} MiB KV value limit.`;
      } else {
        const sevenKey = sevenZipKey(key);
        await kv.put(sevenKey, bytes, { metadata: { size: bytes.byteLength, uploaded: now.toISOString() } });
        backup.sevenZip = { key: sevenKey, size: bytes.byteLength, url: backupFileUrl(sevenKey) };
      }
    } catch (error) {
      console.error("Storing the 7z backup in KV failed:", error);
      sevenZipSkipped = `Storing the 7z copy in KV failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  let pruned: string[] = [];
  if (trigger === "weekly") {
    // Keys carry an ISO timestamp, so sorting them newest-first is exact.
    const weekly = (await listBackups(bucket, `${BACKUP_PREFIX}weekly/`)).map((item) => item.key).sort().reverse();
    pruned = weekly.slice(WEEKLY_BACKUPS_TO_KEEP);
    await deleteBackups(bucket, pruned, kv);
  }

  return { backup, stats, pruned, sevenZipSkipped };
}
