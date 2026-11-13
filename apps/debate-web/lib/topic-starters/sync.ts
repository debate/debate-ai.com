/**
 * @fileoverview The admin panel's "Sync Topic Starters from openCaselist".
 *
 * The old importer took a DOCX or ZIP from the operator's machine and
 * converted it inside the request. A season archive is a different animal: it
 * is hundreds of megabytes of ZIP and thousands of documents, and a Worker
 * cannot hold it, let alone convert it, in one request. So a sync is two
 * steps:
 *
 * 1. **Download to R2** ({@link startTopicStarterSync}). The route discovers
 *    the caselist's newest bulk archive through the openCaselist API, streams
 *    the ZIP into the `CARD_TEXT` R2 bucket, and records a
 *    `topic_starter_imports` row. The request returns as soon as the archive
 *    is stored — no conversion happens in it.
 * 2. **Convert in the background** ({@link processTopicStarterImport}). A
 *    later pass reads the ZIP back out of R2 with HTTP-style Range reads
 *    (through {@link openRemoteZip}, so the archive is never loaded whole),
 *    converts each `.docx` to the `.cmir` a Topic Starter row stores, and
 *    files it under the chosen topic's folder tree. Progress, per-file
 *    failures and the final tally are written back to the job row, which is
 *    what the admin panel polls.
 *
 * The two steps are deliberately separate: the panel can be closed after the
 * ZIP lands, and a resumed pass starts from the job row rather than from a
 * browser tab.
 *
 * @module lib/topic-starters/sync
 */

import { desc, eq, sql } from "drizzle-orm";
import {
  describeDocxImportError,
  isImportableDocxEntry,
  normalizeImportPath,
  readDocxAuthor,
} from "@debate-ai/card-parser";
import {
  fetchCaselistDownloads,
  openRemoteZip,
  parseCaselistSlug,
  readRemoteZipEntries,
  type Caselist,
  type CaselistArchive,
} from "@debate-ai/research-evidence/src/caselist";
import { TOPIC_STARTER_FORMATS } from "@debate-ai/reason-docs/lib/topic-starters/format";
import { docxToStoredCmir } from "@debate-ai/reason-docs/lib/topic-starters/import";
import { findTopicByCode } from "@debate-ai/reason-docs/lib/reason-docs/topic-codes";
import { caselistCredentials } from "@/lib/caselist/team-caselist";
import { getDBFromContext } from "@/lib/database/context";
import { topicStarterImports, topicStarterItems, type TopicStarterImportRow } from "@/lib/database/schema";
import { ensureTopicStarterColumns } from "@/lib/topic-starters/changes";
import { refreshTopicStarterFileIndexQuietly } from "@/lib/topic-starters/file-index";
import { getCardTextBucket, type CardTextBucket } from "@/lib/search/card-text-store";
import { logImportEvent } from "@debate-ai/webview/lib/admin/import-log";
import { fileStatColumns } from "@/lib/file-stats/columns";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

/** R2 prefix for the archives a sync has uploaded. */
const IMPORT_PREFIX = "topic-starters/imports";

/** What a sync asks for: a caselist, where to file its files, and whether to publish them. */
export interface TopicStarterSyncRequest {
  /** openCaselist slug (`hspolicy26`) or its downloads page URL. */
  caselist: string;
  /** Topic code (`vcx27`); empty files under the default topic. */
  topicCode?: string | null;
  published?: boolean;
  /** Admin email, for the job row and the import log. */
  requestedBy?: string | null;
}

/** A failure while starting a sync, with the status the route should answer. */
export class TopicStarterSyncError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "sync-failed",
  ) {
    super(message);
    this.name = "TopicStarterSyncError";
  }
}

/** The table, created on first use — the app ships no migrations. */
const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "topic_starter_imports" (
  "id" text PRIMARY KEY NOT NULL,
  "caselist_slug" text NOT NULL,
  "caselist_label" text DEFAULT '' NOT NULL,
  "archive_file_name" text NOT NULL,
  "archive_url" text NOT NULL,
  "r2_key" text NOT NULL,
  "topic_code" text,
  "year" integer,
  "published" integer DEFAULT true NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "found" integer DEFAULT 0 NOT NULL,
  "imported" integer DEFAULT 0 NOT NULL,
  "failed" integer DEFAULT 0 NOT NULL,
  "failures" text DEFAULT '[]' NOT NULL,
  "error" text,
  "requested_by" text,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL,
  "started_at" integer,
  "finished_at" integer
)`;

let tableReady: Promise<void> | null = null;

function ensureTable(db: Database): Promise<void> {
  tableReady ??= Promise.resolve()
    .then(() => db.run(sql.raw(CREATE_TABLE_SQL)))
    .then(
      () => undefined,
      (error) => {
        tableReady = null;
        throw error;
      },
    );
  return tableReady;
}

/** One file the background pass could not convert. */
interface ImportFailure {
  path: string;
  code: string;
  reason: string;
}

/** The R2 key an archive is stored under. */
export function topicStarterImportKey(slug: string, fileName: string): string {
  return `${IMPORT_PREFIX}/${encodeURIComponent(slug)}/${encodeURIComponent(fileName)}`;
}

/** Mints a job id the panel polls and the logs quote. */
export function newTopicStarterImportId(): string {
  return `tsi_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** The newest archive to sync: the season dump when there is one, else the newest weekly. */
export function pickSyncArchive(downloads: { all: CaselistArchive | null; weekly: CaselistArchive[] }): CaselistArchive | null {
  return downloads.all ?? downloads.weekly[0] ?? null;
}

/**
 * Discovers a caselist's newest archive, uploads it to R2 and records the job.
 *
 * @param request - Which caselist to sync, where to file it, and who asked.
 * @returns The queued job row.
 * @throws {@link TopicStarterSyncError} when openCaselist is not configured,
 *   has no archive, or R2 is not bound.
 */
export async function startTopicStarterSync(request: TopicStarterSyncRequest): Promise<TopicStarterImportRow> {
  const caselist = parseCaselist(request.caselist);
  const credentials = caselistCredentials();
  if (!credentials) {
    throw new TopicStarterSyncError(
      "openCaselist is not configured: set the OPENCASELIST_API_KEY secret (or CASELIST_USERNAME and CASELIST_PASSWORD).",
      503,
      "caselist-not-configured",
    );
  }

  const downloads = await fetchCaselistDownloads(caselist.slug, credentials);
  const archive = pickSyncArchive(downloads);
  if (!archive) {
    const notes = downloads.notes.length > 0 ? ` ${downloads.notes.join(" ")}` : "";
    throw new TopicStarterSyncError(
      `openCaselist lists no bulk archive for ${caselist.slug} yet.${notes}`,
      404,
      "no-archive",
    );
  }

  const topicCode = request.topicCode?.trim() || null;
  if (topicCode && !findTopicByCode(topicCode)) {
    throw new TopicStarterSyncError(`"${topicCode}" is not a topic this site knows.`, 400, "unknown-topic");
  }
  const year = findTopicByCode(topicCode)?.year ?? caselist.year;

  const bucket = getCardTextBucket();
  if (!bucket) {
    throw new TopicStarterSyncError(
      "Topic Starter sync needs an R2 bucket: bind CARD_TEXT in wrangler.jsonc.",
      503,
      "no-bucket",
    );
  }

  const db = await getDBFromContext();
  await ensureTable(db);

  const key = topicStarterImportKey(caselist.slug, archive.fileName);
  const existing = await readJob(db, key);
  if (existing && (existing.status === "queued" || existing.status === "processing")) return existing;

  // Stream the archive into R2 rather than buffering a season dump in the
  // Worker. A re-run of an archive that is already stored skips the download.
  const alreadyStored = bucket.head ? await bucket.head(key).catch(() => null) : null;
  if (!alreadyStored) {
    const response = await fetch(archive.url);
    if (!response.ok || !response.body) {
      throw new TopicStarterSyncError(
        `Downloading ${archive.fileName} failed: ${response.status} ${response.statusText}`.trim(),
        502,
        "download-failed",
      );
    }
    await bucket.put(key, response.body, { httpMetadata: { contentType: "application/zip" } });
  }

  const id = newTopicStarterImportId();
  const [row] = await db
    .insert(topicStarterImports)
    .values({
      id,
      caselistSlug: caselist.slug,
      caselistLabel: caselist.label,
      archiveFileName: archive.fileName,
      archiveUrl: archive.url,
      r2Key: key,
      topicCode,
      year,
      published: request.published !== false,
      status: "queued",
      requestedBy: request.requestedBy ?? null,
    })
    .returning();

  logImportEvent({
    importId: id,
    stage: "received",
    admin: request.requestedBy,
    fileName: archive.fileName,
    topicCode,
    reason: `${caselist.label} queued for background conversion`,
  });

  return requireRow(row, "topic starter import");
}

/** Reads one job by id. */
export async function getTopicStarterImport(id: string): Promise<TopicStarterImportRow | null> {
  const db = await getDBFromContext();
  await ensureTable(db);
  const [row] = await db.select().from(topicStarterImports).where(eq(topicStarterImports.id, id)).limit(1);
  return row ?? null;
}

/** Reads the newest jobs, for the panel when it does not know an id. */
export async function listTopicStarterImports(limit = 10): Promise<TopicStarterImportRow[]> {
  const db = await getDBFromContext();
  await ensureTable(db);
  return db.select().from(topicStarterImports).orderBy(desc(topicStarterImports.createdAt)).limit(limit);
}

/** Reads a job by its R2 key (used to resume an archive already uploaded). */
async function readJob(db: Database, r2Key: string): Promise<TopicStarterImportRow | null> {
  const [row] = await db
    .select()
    .from(topicStarterImports)
    .where(eq(topicStarterImports.r2Key, r2Key))
    .orderBy(desc(topicStarterImports.createdAt))
    .limit(1);
  return row ?? null;
}

/** Jobs this isolate is already converting, so a retry cannot double-import. */
const inFlight = new Set<string>();

/** The columns a background pass changes, with failures as objects until stored. */
type JobPatch = Partial<Omit<TopicStarterImportRow, "failures">> & { failures?: ImportFailure[] };

/**
 * Converts one queued job's archive into Topic Starter rows.
 *
 * Safe to call more than once: a finished job is a no-op, and a job another
 * request is already converting is skipped for the life of the isolate.
 *
 * @param id - The job id from {@link startTopicStarterSync}.
 * @returns The job row after the pass.
 */
export async function processTopicStarterImport(id: string): Promise<TopicStarterImportRow> {
  const db = await getDBFromContext();
  await ensureTable(db);
  const job = await getTopicStarterImport(id);
  if (!job) throw new Error(`Unknown Topic Starter sync ${id}.`);
  if (job.status === "succeeded" || job.status === "partial" || job.status === "failed") return job;
  if (inFlight.has(id)) return job;
  inFlight.add(id);

  try {
    await updateJob(db, id, { status: "processing", startedAt: job.startedAt ?? new Date() });
    const bucket = getCardTextBucket();
    if (!bucket) throw new Error("The CARD_TEXT R2 bucket is not bound.");

    const fetchImpl = bucketArchiveFetch(bucket, job.r2Key);
    const zip = await openRemoteZip(job.archiveUrl, { fetchImpl });
    const entries = zip.entries
      .filter((entry) => isImportableDocxEntry(entry.name, entry.dir))
      .sort((a, b) => a.offset - b.offset);

    await ensureTopicStarterColumns(db);
    const root = await createRoot(db, job, entries.length);
    const writer = new ImportWriter(db, root.id, job);
    const failures: ImportFailure[] = [];
    let imported = 0;

    await readRemoteZipEntries(zip, entries, async (entry, result) => {
      if ("error" in result) {
        failures.push({
          path: normalizeImportPath(entry.name) || entry.name,
          code: (result.error as unknown as { code?: string }).code ?? "unreadable",
          reason: result.error.message,
        });
        return;
      }
      try {
        await writer.add({ path: entry.name, bytes: result.bytes }, job.requestedBy);
        imported += 1;
      } catch (error) {
        failures.push({ path: normalizeImportPath(entry.name) || entry.name, ...describeDocxImportError(error) });
      }
      if (imported % 5 === 0) {
        await updateJob(db, id, { found: entries.length, imported, failed: failures.length, failures });
      }
    }, { fetchImpl });

    if (imported === 0) {
      await db.delete(topicStarterItems).where(eq(topicStarterItems.id, root.id));
    } else if (job.published) {
      await refreshTopicStarterFileIndexQuietly(db);
    }

    const summary =
      imported === 0
        ? `Nothing imported — ${failures.length} file${failures.length === 1 ? "" : "s"} failed.`
        : failures.length > 0
          ? `Imported ${imported} file${imported === 1 ? "" : "s"}; ${failures.length} failed.`
          : `Imported ${imported} file${imported === 1 ? "" : "s"}.`;
    const status = imported === 0 ? "failed" : failures.length > 0 ? "partial" : "succeeded";
    const finished: JobPatch = {
      status,
      found: entries.length,
      imported,
      failed: failures.length,
      failures,
      error: imported === 0 ? summary : null,
      finishedAt: new Date(),
    };
    await updateJob(db, id, finished);
    logImportEvent({
      importId: id,
      stage: status === "failed" ? "failed" : status === "partial" ? "partial" : "succeeded",
      admin: job.requestedBy,
      fileName: job.archiveFileName,
      topicCode: job.topicCode,
      reason: summary,
      counts: { found: entries.length, imported, failed: failures.length },
    });

    // The archive has been converted; keep R2 from holding a season dump for
    // every run. A failure is not worth failing the job over.
    if (status === "succeeded") await bucket.delete?.(job.r2Key).catch(() => undefined);
    return (await getTopicStarterImport(id))!;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateJob(db, id, { status: "failed", error: message, finishedAt: new Date() });
    logImportEvent({ importId: id, stage: "crashed", reason: message, error });
    return (await getTopicStarterImport(id))!;
  } finally {
    inFlight.delete(id);
  }
}

/** One conversion pass's state: the root folder and its folder cache. */
class ImportWriter {
  private readonly folders: Map<string, number>;

  constructor(
    private readonly db: Database,
    private readonly rootId: number,
    private readonly job: TopicStarterImportRow,
  ) {
    this.folders = new Map([["", rootId]]);
  }

  async add(entry: { path: string; bytes: Uint8Array }, importerName: string | null): Promise<void> {
    const bytes = toArrayBuffer(entry.bytes);
    const content = await docxToStoredCmir(bytes);
    const author = (await readDocxAuthor(bytes)) ?? importerName;
    const stats = await fileStatColumns(content, TOPIC_STARTER_FORMATS.cmir);
    const parts = normalizeImportPath(entry.path).split("/").filter(Boolean);
    let parentId = this.rootId;
    for (let index = 0; index < parts.length - 1; index++) {
      const path = parts.slice(0, index + 1).join("/");
      const existing = this.folders.get(path);
      if (existing !== undefined) {
        parentId = existing;
        continue;
      }
      const [folder] = await this.db
        .insert(topicStarterItems)
        .values({
          title: parts[index]!,
          parentId,
          isFolder: true,
          tags: JSON.stringify(["folder"]),
          published: this.job.published,
          year: this.job.year,
          topicCode: this.job.topicCode,
        })
        .returning();
      const folderId = requireRow(folder, "folder").id;
      this.folders.set(path, folderId);
      parentId = folderId;
    }

    await this.db.insert(topicStarterItems).values({
      title: (parts.at(-1) ?? entry.path).replace(/\.docx$/i, ""),
      parentId,
      content,
      format: TOPIC_STARTER_FORMATS.cmir,
      tags: JSON.stringify(["cmir", this.job.published ? "public" : "private"]),
      published: this.job.published,
      year: this.job.year,
      topicCode: this.job.topicCode,
      author,
      ...stats,
    });
  }
}

/** Creates the folder every imported file lands under. */
async function createRoot(db: Database, job: TopicStarterImportRow, found: number): Promise<{ id: number }> {
  const title = job.archiveFileName.replace(/\.zip$/i, "") || job.caselistLabel || job.caselistSlug;
  const [root] = await db
    .insert(topicStarterItems)
    .values({
      title,
      isFolder: true,
      tags: JSON.stringify(["topic-starter", "caselist-sync"]),
      published: job.published,
      year: job.year,
      topicCode: job.topicCode,
    })
    .returning();
  await updateJob(db, job.id, { found });
  return requireRow(root, "root folder");
}

/** Updates the columns a background pass changes. */
async function updateJob(db: Database, id: string, patch: JobPatch): Promise<void> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    values[key] = value;
  }
  if (patch.failures) values.failures = JSON.stringify(patch.failures);
  if (Object.keys(values).length === 0) return;
  await db.update(topicStarterImports).set(values).where(eq(topicStarterImports.id, id));
}

/**
 * A `fetch` look-alike over an R2 object.
 *
 * `openRemoteZip` only needs HEAD (for the size) and `Range` GETs. R2's
 * binding speaks `head`/`get({ range })` rather than HTTP, so this adapts the
 * two so the same streaming ZIP reader works against a bucket as against a
 * URL.
 */
function bucketArchiveFetch(bucket: CardTextBucket, key: string): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "HEAD") {
      if (!bucket.head) throw new Error("The R2 binding cannot report an object's size.");
      const object = await bucket.head(key);
      if (!object) return new Response(null, { status: 404 });
      return new Response(null, { status: 200, headers: { "content-length": String(object.size) } });
    }

    const headers = new Headers(init?.headers);
    const range = /^bytes=(\d+)-(\d+)$/i.exec(headers.get("range") ?? "");
    if (!range) {
      const object = await bucket.get(key);
      if (!object) return new Response(null, { status: 404 });
      if (!object.arrayBuffer) throw new Error("The R2 binding cannot read an object's bytes.");
      const bytes = await object.arrayBuffer();
      return new Response(bytes, { status: 200, headers: { "content-length": String(bytes.byteLength) } });
    }

    const offset = Number(range[1]);
    const end = Number(range[2]);
    const length = Math.max(0, end - offset + 1);
    const object = await bucket.get(key, { range: { offset, length } });
    if (!object) return new Response(null, { status: 404 });
    if (!object.arrayBuffer) throw new Error("The R2 binding cannot read an object's bytes.");
    const bytes = await object.arrayBuffer();
    return new Response(bytes, {
      status: 206,
      headers: {
        "content-length": String(bytes.byteLength),
        "content-range": `bytes ${offset}-${offset + bytes.byteLength - 1}/*`,
      },
    });
  }) as typeof fetch;
}

/** Parses a slug, path or URL into a known caselist. */
function parseCaselist(value: string): Caselist {
  const caselist = parseCaselistSlug(value);
  if (!caselist) throw new TopicStarterSyncError(`Unknown openCaselist caselist: ${value}`, 400, "unknown-caselist");
  return caselist;
}

/** Drizzle types `.returning()` as possibly empty; fail loudly if it is. */
function requireRow<T>(row: T | undefined, label: string): T {
  if (!row) throw new Error(`The database did not return the inserted ${label} row.`);
  return row;
}

/** A `Uint8Array` view's bytes as a standalone `ArrayBuffer`. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}