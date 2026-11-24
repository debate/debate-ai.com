/**
 * @fileoverview `db-backup-r2` against in-memory fakes of the R2 bucket and KV
 * namespace, and a real SQLite database for the dump itself: the multipart
 * upload's part sizes, the gzip member R2 stores (gunzipped back to the dump),
 * the 7z copy in KV over the same Deflate stream, the KV size cap, listing and
 * pruning, and aborting a failed upload.
 */

import { gunzipSync, inflateRawSync } from "node:zlib"
import { beforeEach, describe, expect, it, vi } from "vitest"

import * as schema from "@/lib/database/schema"
import { freshDb, type DB } from "../helpers/db"

let workerEnv: Record<string, unknown> | undefined
vi.mock("@/lib/database/context", () => ({ getCloudflareContext: () => (workerEnv ? { env: workerEnv } : null) }))

const r2 = await import("../../src/lib/db-backup-r2")
const { crc32 } = await import("../../src/lib/seven-zip")

/** Concatenates byte arrays. */
const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.byteLength
  }
  return out
}

interface StoredObject {
  key: string
  bytes: Uint8Array
  uploaded: Date
  customMetadata?: Record<string, string>
  httpMetadata?: Record<string, string>
}

/** An R2 bucket kept in a Map, with a page size to exercise list cursors. */
function fakeBucket(pageSize = 1000) {
  const objects = new Map<string, StoredObject>()
  const uploads: Array<{ key: string; parts: Uint8Array[]; aborted: boolean; completed: boolean }> = []
  let failPart: number | null = null
  const bucket: r2.R2BucketLike = {
    async createMultipartUpload(key, options) {
      const state = { key, parts: [] as Uint8Array[], aborted: false, completed: false }
      uploads.push(state)
      return {
        async uploadPart(partNumber, value) {
          if (failPart === partNumber) throw new Error(`part ${partNumber} failed`)
          expect(partNumber).toBe(state.parts.length + 1)
          state.parts.push(value.slice())
          return { partNumber, etag: `etag-${partNumber}` }
        },
        async complete(parts) {
          expect(parts.map((p) => p.partNumber)).toEqual(state.parts.map((_, i) => i + 1))
          state.completed = true
          const bytes = concat(state.parts)
          const stored = { key, bytes, uploaded: new Date(), customMetadata: options?.customMetadata, httpMetadata: options?.httpMetadata }
          objects.set(key, stored)
          return { key, size: bytes.byteLength, uploaded: stored.uploaded, customMetadata: stored.customMetadata }
        },
        async abort() {
          state.aborted = true
        },
      }
    },
    async get(key) {
      const o = objects.get(key)
      return o ? { key, size: o.bytes.byteLength, uploaded: o.uploaded, body: new Blob([o.bytes]).stream() } : null
    },
    async head(key) {
      const o = objects.get(key)
      return o ? { key, size: o.bytes.byteLength, uploaded: o.uploaded } : null
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key)
    },
    async list(options) {
      const all = [...objects.values()].filter((o) => o.key.startsWith(options?.prefix ?? "")).sort((a, b) => a.key.localeCompare(b.key))
      const start = Number(options?.cursor ?? 0)
      const page = all.slice(start, start + pageSize)
      const truncated = start + pageSize < all.length
      return {
        objects: page.map((o) => ({ key: o.key, size: o.bytes.byteLength, uploaded: o.uploaded, customMetadata: o.customMetadata })),
        truncated,
        cursor: truncated ? String(start + pageSize) : undefined,
      }
    },
  }
  return {
    bucket,
    objects,
    uploads,
    failOnPart(n: number | null) {
      failPart = n
    },
  }
}

/** A KV namespace kept in a Map, paging its list one key at a time. */
function fakeKv() {
  const values = new Map<string, { bytes: Uint8Array; metadata?: r2.SevenZipMetadata }>()
  let failPut = false
  const kv: r2.KVNamespaceLike = {
    async put(key, value, options) {
      if (failPut) throw new Error("KV quota")
      values.set(key, { bytes: new Uint8Array(value as ArrayBuffer).slice(), metadata: options?.metadata })
    },
    async get(key) {
      const v = values.get(key)
      return v ? new Blob([v.bytes]).stream() : null
    },
    async delete(key) {
      values.delete(key)
    },
    async list(options) {
      const keys = [...values.keys()].filter((k) => k.startsWith(options?.prefix ?? "")).sort()
      const start = Number(options?.cursor ?? 0)
      const page = keys.slice(start, start + 1)
      const complete = start + 1 >= keys.length
      return {
        keys: page.map((name) => ({ name, metadata: values.get(name)!.metadata })),
        list_complete: complete,
        cursor: complete ? undefined : String(start + 1),
      }
    },
  }
  return {
    kv,
    values,
    failPuts(on: boolean) {
      failPut = on
    },
  }
}

async function* bytesOf(...chunks: Uint8Array[]) {
  for (const chunk of chunks) yield chunk
}

let db: DB
const backupDb = () => ({ all: (query: Parameters<DB["all"]>[0]) => db.all(query) as Promise<unknown[]> })

beforeEach(async () => {
  workerEnv = undefined
  db = await freshDb()
})

describe("key and binding helpers", () => {
  it("maps an R2 key to its 7z copy", () => {
    expect(r2.sevenZipKey("db-backups/weekly/x.sql.gz")).toBe("db-backups/weekly/x.sql.7z")
    expect(r2.sevenZipKey("db-backups/manual/x.sql")).toBe("db-backups/manual/x.sql.7z")
    expect(r2.sevenZipKey("db-backups/manual/x.txt")).toBe("db-backups/manual/x.txt")
  })

  it.each([
    ["db-backups/manual/a.sql.gz", true],
    ["db-backups/weekly/a.sql.7z", true],
    ["db-backups/a.sql", true],
    ["db-backups/../secrets.sql", false],
    ["other/a.sql.gz", false],
    ["db-backups/a.sql.zip", false],
    ["db-backups/a.json", false],
  ])("isBackupKey(%j) is %s", (key, expected) => {
    expect(r2.isBackupKey(key)).toBe(expected)
  })

  it("builds an encoded admin download link", () => {
    expect(r2.backupFileUrl("db-backups/manual/a b&c.sql.gz")).toBe("/api/admin/db-backup/file?key=db-backups%2Fmanual%2Fa%20b%26c.sql.gz")
  })

  it("finds the bindings only when they look like R2 and KV", () => {
    expect(r2.getBackupBucket()).toBeNull()
    expect(r2.getBackupKv()).toBeNull()
    workerEnv = { DB_BACKUPS: { get() {} }, DB_BACKUPS_KV: { put() {} } }
    expect(r2.getBackupBucket()).toBeNull()
    expect(r2.getBackupKv()).toBeNull()
    const { bucket } = fakeBucket()
    const { kv } = fakeKv()
    workerEnv = { DB_BACKUPS: bucket, DB_BACKUPS_KV: kv }
    expect(r2.getBackupBucket()).toBe(bucket)
    expect(r2.getBackupKv()).toBe(kv)
  })
})

describe("uploadGzippedStream", () => {
  it("cuts the gzip member into equal parts, the last one shorter, and it gunzips to the input", async () => {
    const { bucket, objects, uploads } = fakeBucket()
    const input = new TextEncoder().encode("abc".repeat(30))
    const { deflateRawSync } = await import("node:zlib")
    const packed = new Uint8Array(deflateRawSync(input))
    const sizes = () => ({ crc: crc32(input), packedSize: packed.byteLength, uncompressedSize: input.byteLength })

    // Split the packed bytes oddly so parts straddle chunk boundaries.
    const result = await r2.uploadGzippedStream(bucket, "db-backups/manual/t.sql.gz", bytesOf(packed.subarray(0, 3), packed.subarray(3)), sizes, { trigger: "manual" }, 7)

    const parts = uploads[0].parts
    expect(parts.slice(0, -1).every((p) => p.byteLength === 7)).toBe(true)
    expect(parts.at(-1)!.byteLength).toBeGreaterThan(0)
    expect(parts.at(-1)!.byteLength).toBeLessThanOrEqual(7)
    expect(result.size).toBe(10 + packed.byteLength + 8)
    const stored = objects.get("db-backups/manual/t.sql.gz")!
    expect(stored.httpMetadata).toEqual({ contentType: "application/gzip" })
    expect(stored.customMetadata).toEqual({ trigger: "manual" })
    expect(new TextDecoder().decode(gunzipSync(stored.bytes))).toBe("abc".repeat(30))
  })

  it("emits no empty trailing part when the data ends exactly on a part boundary", async () => {
    const { bucket, uploads } = fakeBucket()
    // 10-byte gzip header + 0 packed bytes + 8-byte trailer = 18 = 2 × 9.
    await r2.uploadGzippedStream(bucket, "db-backups/x.sql.gz", bytesOf(), () => ({ crc: 0, packedSize: 0, uncompressedSize: 0 }), {}, 9)
    expect(uploads[0].parts.map((p) => p.byteLength)).toEqual([9, 9])
  })

  it("aborts the upload and rethrows when a part fails", async () => {
    const { bucket, uploads, objects, failOnPart } = fakeBucket()
    failOnPart(2)
    await expect(
      r2.uploadGzippedStream(bucket, "db-backups/x.sql.gz", bytesOf(new Uint8Array(20)), () => ({ crc: 0, packedSize: 20, uncompressedSize: 20 }), {}, 5),
    ).rejects.toThrow("part 2 failed")
    expect(uploads[0]).toMatchObject({ aborted: true, completed: false })
    expect(objects.size).toBe(0)
  })

  it("aborts when the packed stream itself throws", async () => {
    const { bucket, uploads } = fakeBucket()
    async function* broken() {
      yield new Uint8Array(1)
      throw new Error("dump failed")
    }
    await expect(r2.uploadGzippedStream(bucket, "db-backups/x.sql.gz", broken(), () => ({ crc: 0, packedSize: 0, uncompressedSize: 0 }))).rejects.toThrow("dump failed")
    expect(uploads[0].aborted).toBe(true)
  })
})

describe("createR2Backup", () => {
  const NOW = new Date("2026-11-24T08:00:00.000Z")

  beforeEach(async () => {
    await db.insert(schema.videos).values(
      Array.from({ length: 5 }, (_, i) => ({
        videoId: `video${String(i).padStart(6, "0")}`,
        source: "round",
        title: `Round ${i} — it's "quoted"`,
        publishedAt: "2026-01-01",
        publishedMs: 0,
        channel: "C",
        viewCount: i,
        description: "",
        seasonYear: 2026,
        searchText: "",
      })) as never,
    )
  })

  it("stores a gzipped dump in R2 and the same dump as a 7z copy in KV", async () => {
    const { bucket, objects } = fakeBucket()
    const { kv, values } = fakeKv()
    const result = await r2.createR2Backup(backupDb(), bucket, ["videos"], "manual", NOW, kv)

    expect(result.backup.key).toMatch(/^db-backups\/manual\/.+\.sql\.gz$/)
    expect(result.backup).toMatchObject({ trigger: "manual", groups: "videos", url: r2.backupFileUrl(result.backup.key) })
    expect(result.stats.tables.videos).toBe(5)
    expect(result.stats.totalRows).toBeGreaterThanOrEqual(5)
    expect(result.pruned).toEqual([])
    expect(result.sevenZipSkipped).toBeNull()

    const dump = new TextDecoder().decode(gunzipSync(objects.get(result.backup.key)!.bytes))
    expect(dump).toContain("video000004")
    expect(dump).toContain(`'Round 4 — it''s "quoted"'`)

    const sevenKey = r2.sevenZipKey(result.backup.key)
    const seven = values.get(sevenKey)!
    expect(result.backup.sevenZip).toEqual({ key: sevenKey, size: seven.bytes.byteLength, url: r2.backupFileUrl(sevenKey) })
    expect(seven.metadata).toEqual({ size: seven.bytes.byteLength, uploaded: NOW.toISOString() })
    // The 7z packed stream starts right after the 32-byte signature header
    // and is the same Deflate stream the gzip member wraps.
    const gz = objects.get(result.backup.key)!.bytes
    const packed = gz.subarray(10, gz.byteLength - 8)
    expect(Buffer.from(seven.bytes.subarray(32, 32 + packed.byteLength)).equals(Buffer.from(packed))).toBe(true)
    expect(new TextDecoder().decode(inflateRawSync(seven.bytes.subarray(32, 32 + packed.byteLength)))).toBe(dump)
  })

  it("says why no 7z copy was kept when KV is unbound, over the cap, or failing", async () => {
    const { bucket } = fakeBucket()
    expect((await r2.createR2Backup(backupDb(), bucket, ["videos"], "manual", NOW)).sevenZipSkipped).toBe("No KV namespace bound as DB_BACKUPS_KV.")

    const tiny = fakeKv()
    const capped = await r2.createR2Backup(backupDb(), bucket, ["videos"], "manual", NOW, tiny.kv, 1100)
    expect(capped.sevenZipSkipped).toMatch(/larger than the 0 MiB KV value limit/)
    expect(capped.backup.sevenZip).toBeNull()
    expect(tiny.values.size).toBe(0)

    const failing = fakeKv()
    failing.failPuts(true)
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    const failed = await r2.createR2Backup(backupDb(), bucket, ["videos"], "manual", NOW, failing.kv)
    expect(failed.sevenZipSkipped).toBe("Storing the 7z copy in KV failed: KV quota")
    expect(errors).toHaveBeenCalled()
    errors.mockRestore()
  })

  it("prunes weekly backups to the newest twelve, with their 7z copies, and never touches manual ones", async () => {
    const { bucket, objects } = fakeBucket(5)
    const { kv, values } = fakeKv()
    for (let week = 0; week < 14; week++) {
      const key = `db-backups/weekly/db-backup-2026-01-${String(week + 1).padStart(2, "0")}.sql.gz`
      objects.set(key, { key, bytes: new Uint8Array(1), uploaded: new Date(2026, 0, week + 1), customMetadata: { trigger: "weekly" } })
      values.set(r2.sevenZipKey(key), { bytes: new Uint8Array(1), metadata: { size: 1, uploaded: "" } })
    }
    objects.set("db-backups/manual/old.sql.gz", { key: "db-backups/manual/old.sql.gz", bytes: new Uint8Array(1), uploaded: new Date(2020, 0, 1) })

    const result = await r2.createR2Backup(backupDb(), bucket, ["videos"], "weekly", NOW, kv)
    // 14 old + the new one = 15; the three oldest go.
    expect(result.pruned).toEqual([
      "db-backups/weekly/db-backup-2026-01-03.sql.gz",
      "db-backups/weekly/db-backup-2026-01-02.sql.gz",
      "db-backups/weekly/db-backup-2026-01-01.sql.gz",
    ])
    const weekly = [...objects.keys()].filter((k) => k.startsWith("db-backups/weekly/"))
    expect(weekly).toHaveLength(r2.WEEKLY_BACKUPS_TO_KEEP)
    expect(weekly).toContain(result.backup.key)
    expect(objects.has("db-backups/manual/old.sql.gz")).toBe(true)
    for (const key of result.pruned) expect(values.has(r2.sevenZipKey(key))).toBe(false)
  })
})

describe("listBackups and deleteBackups", () => {
  it("pages through R2 and KV, newest first, attaching 7z copies and reading triggers", async () => {
    const { bucket, objects } = fakeBucket(2)
    const { kv, values } = fakeKv()
    const add = (key: string, uploaded: string, meta?: Record<string, string>) =>
      objects.set(key, { key, bytes: new Uint8Array(3), uploaded: new Date(uploaded), customMetadata: meta })
    add("db-backups/manual/a.sql.gz", "2026-01-01", { trigger: "manual", groups: "videos" })
    add("db-backups/weekly/b.sql.gz", "2026-03-01", { trigger: "weekly" })
    add("db-backups/c.sql", "2026-02-01", { trigger: "cron?" })
    values.set("db-backups/weekly/b.sql.7z", { bytes: new Uint8Array(1), metadata: { size: 42, uploaded: "" } })
    values.set("db-backups/manual/a.sql.7z", { bytes: new Uint8Array(1) })

    const list = await r2.listBackups(bucket, r2.BACKUP_PREFIX, kv)
    expect(list.map((b) => [b.fileName, b.trigger, b.groups])).toEqual([
      ["b.sql.gz", "weekly", null],
      ["c.sql", "unknown", null],
      ["a.sql.gz", "manual", "videos"],
    ])
    expect(list[0].sevenZip).toEqual({ key: "db-backups/weekly/b.sql.7z", size: 42, url: r2.backupFileUrl("db-backups/weekly/b.sql.7z") })
    // A copy with no metadata still shows, with an unknown (0) size.
    expect(list[2].sevenZip?.size).toBe(0)
    expect(list[1].sevenZip).toBeNull()

    expect((await r2.listBackups(bucket)).every((b) => b.sevenZip === null)).toBe(true)

    await r2.deleteBackups(bucket, ["db-backups/weekly/b.sql.gz"], kv)
    expect(objects.has("db-backups/weekly/b.sql.gz")).toBe(false)
    expect(values.has("db-backups/weekly/b.sql.7z")).toBe(false)
    await r2.deleteBackups(bucket, [], kv)
    expect(objects.size).toBe(2)
  })
})
