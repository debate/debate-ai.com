/**
 * @fileoverview The content-table SQL backup: what it reads, what it blanks,
 * that its output restores into an empty database, and that the R2 upload
 * reassembles into the same dump.
 */
import { gunzipSync, inflateRawSync } from "node:zlib";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { cardAiAnalyses, debateCards, user, videoIssues, videos } from "../../database/schema";
import {
  BACKUP_TABLES,
  emptyBackupStats,
  generateBackupSql,
  pageEnd,
  PAGE_BYTE_BUDGET,
  parseBackupGroups,
  sqlLiteral,
  type BackupDb,
} from "../db-backup";
import {
  createR2Backup,
  deleteBackups,
  isBackupKey,
  listBackups,
  sevenZipKey,
  type KVNamespaceLike,
  type R2BucketLike,
  type R2ObjectLike,
} from "../db-backup-r2";
import { crc32 } from "../seven-zip";

let ddl: string[] | undefined;

async function freshDb(skipTables: string[] = []) {
  ddl ??= await generateSQLiteMigration(await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(schema));
  const client = createClient({ url: ":memory:" });
  for (const statement of ddl) {
    const table = statement.match(/^CREATE TABLE `([^`]+)`/)?.[1];
    const indexOn = statement.match(/^CREATE (?:UNIQUE )?INDEX .* ON `([^`]+)`/)?.[1];
    if (skipTables.includes(table ?? indexOn ?? "")) continue;
    await client.execute(statement);
  }
  return { client, db: drizzle(client, { schema }) };
}

async function seed(db: Awaited<ReturnType<typeof freshDb>>["db"]) {
  const now = new Date("2026-09-01");
  await db.insert(user).values({ id: "u1", name: "Secret Person", email: "secret@example.com", createdAt: now, updatedAt: now });
  await db.insert(videos).values([
    { videoId: "abc", source: "youtube", title: "It's a round", viewCount: 42 },
    { videoId: "def", source: "youtube", title: "Second", affWin: true },
  ]);
  await db.insert(videoIssues).values({ id: "i1", videoId: "abc", issue: "wrong style", reportedBy: "reporter@example.com" });
  await db.insert(debateCards).values(
    Array.from({ length: 450 }, (_, i) => ({ id: i + 1, tag: `Tag ${i}`, fulltext: "line1\nline2 'quoted'" })),
  );
  await db.insert(cardAiAnalyses).values({ cardHash: "c", promptHash: "p", result: "{}", userId: "u1" });
}

async function dump(db: BackupDb, groups = parseBackupGroups(null)) {
  const stats = emptyBackupStats();
  let out = "";
  for await (const chunk of generateBackupSql(db, groups, stats, new Date("2026-09-28T07:00:00Z"))) out += chunk;
  return { sql: out, stats };
}

describe("sqlLiteral", () => {
  it("escapes and encodes values", () => {
    expect(sqlLiteral(null)).toBe("NULL");
    expect(sqlLiteral(3)).toBe("3");
    expect(sqlLiteral(true)).toBe("1");
    expect(sqlLiteral("it's")).toBe("'it''s'");
    expect(sqlLiteral([1, 255])).toBe("X'01ff'");
  });
});

describe("parseBackupGroups", () => {
  it("keeps known groups and defaults to all", () => {
    expect(parseBackupGroups("videos,bogus")).toEqual(["videos"]);
    expect(parseBackupGroups("")).toEqual(["videos", "cards", "history"]);
  });
});

describe("generateBackupSql", () => {
  it("never reads account tables", () => {
    const names = BACKUP_TABLES.map((table) => table.name);
    for (const forbidden of ["user", "session", "account", "detected_urls", "saved_flows", "notifications", "person"]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("dumps content, scrubs personal columns and restores into an empty database", async () => {
    const source = await freshDb();
    await seed(source.db);
    const { sql, stats } = await dump(source.db as unknown as BackupDb);

    expect(stats.tables.videos).toBe(2);
    expect(stats.tables.debate_cards).toBe(450);
    expect(sql).not.toContain("secret@example.com");
    expect(sql).not.toContain("reporter@example.com");
    expect(sql).not.toContain("Secret Person");
    expect(sql).not.toMatch(/INSERT OR REPLACE INTO "user"/);
    expect(sql).not.toMatch(/BEGIN|COMMIT/);

    const target = createClient({ url: ":memory:" });
    await target.executeMultiple(sql);
    const cards = await target.execute('SELECT COUNT(*) AS n FROM "debate_cards"');
    expect(Number(cards.rows[0].n)).toBe(450);
    const card = await target.execute('SELECT fulltext FROM "debate_cards" WHERE id = 7');
    expect(card.rows[0].fulltext).toBe("line1\nline2 'quoted'");
    const video = await target.execute(`SELECT title, view_count FROM "videos" WHERE video_id = 'abc'`);
    expect(video.rows[0]).toMatchObject({ title: "It's a round", view_count: 42 });
    const issue = await target.execute('SELECT reported_by FROM "video_issues"');
    expect(issue.rows[0].reported_by).toBeNull();
    const analysis = await target.execute('SELECT user_id FROM "card_ai_analyses"');
    expect(analysis.rows[0].user_id).toBeNull();

    // Re-running the same dump over the restored copy is safe.
    await target.executeMultiple(sql);
    const again = await target.execute('SELECT COUNT(*) AS n FROM "debate_cards"');
    expect(Number(again.rows[0].n)).toBe(450);
  });

  it("only includes the chosen groups and notes missing tables", async () => {
    const source = await freshDb(["video_relations"]);
    await seed(source.db);
    const { sql, stats } = await dump(source.db as unknown as BackupDb, ["videos"]);
    expect(sql).toContain('"videos"');
    expect(sql).not.toContain('"debate_cards"');
    expect(stats.missing).toEqual(["video_relations"]);
  });
});

/** In-memory stand-in for the R2 binding's multipart surface. */
function fakeBucket() {
  const objects = new Map<string, { data: Uint8Array; object: R2ObjectLike }>();
  const partSizes: number[] = [];
  const bucket: R2BucketLike = {
    async createMultipartUpload(key, options) {
      const parts = new Map<number, Uint8Array>();
      return {
        async uploadPart(partNumber, value) {
          parts.set(partNumber, value);
          partSizes.push(value.byteLength);
          return { partNumber, etag: String(partNumber) };
        },
        async complete(uploaded) {
          const chunks = uploaded.map((part) => parts.get(part.partNumber) as Uint8Array);
          const data = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
          let offset = 0;
          for (const chunk of chunks) {
            data.set(chunk, offset);
            offset += chunk.byteLength;
          }
          const object = { key, size: data.byteLength, uploaded: new Date(), customMetadata: options?.customMetadata };
          objects.set(key, { data, object });
          return object;
        },
        async abort() {},
      };
    },
    async get() {
      return null;
    },
    async head() {
      return null;
    },
    async delete(keys) {
      for (const key of [keys].flat()) objects.delete(key);
    },
    async list(options) {
      return {
        objects: [...objects.values()].map((entry) => entry.object).filter((object) => object.key.startsWith(options?.prefix ?? "")),
        truncated: false,
      };
    },
  };
  return { bucket, objects, partSizes };
}

function fakeKv() {
  const values = new Map<string, { data: Uint8Array; metadata?: unknown }>();
  const kv: KVNamespaceLike = {
    async put(key, value, options) {
      values.set(key, { data: new Uint8Array(value as ArrayBuffer), metadata: options?.metadata });
    },
    async get(key) {
      const value = values.get(key);
      return value ? new Blob([value.data as Uint8Array<ArrayBuffer>]).stream() : null;
    },
    async delete(key) {
      values.delete(key);
    },
    async list(options) {
      const keys = [...values.entries()]
        .filter(([key]) => key.startsWith(options?.prefix ?? ""))
        .map(([name, value]) => ({ name, metadata: value.metadata }));
      return { keys, list_complete: true };
    },
  };
  return { kv, values };
}

/** Reads a single-file Deflate `.7z` back, checking both header CRCs and the data CRC. */
function unpack7z(archive: Uint8Array): string {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  expect([...archive.subarray(0, 6)]).toEqual([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);
  expect(view.getUint32(8, true)).toBe(crc32(archive.subarray(12, 32)));
  const nextOffset = Number(view.getBigUint64(12, true));
  const nextSize = Number(view.getBigUint64(20, true));
  const header = archive.subarray(32 + nextOffset, 32 + nextOffset + nextSize);
  expect(32 + nextOffset + nextSize).toBe(archive.byteLength);
  expect(view.getUint32(28, true)).toBe(crc32(header));
  // The Deflate method id sits in the folder's coder record.
  expect(Buffer.from(header).includes(Buffer.from([0x03, 0x04, 0x01, 0x08]))).toBe(true);
  const data = inflateRawSync(archive.subarray(32, 32 + nextOffset));
  const crcAt = Buffer.from(header).indexOf(Buffer.from([0x0a, 0x01])) + 2;
  expect(new DataView(header.buffer, header.byteOffset).getUint32(crcAt, true)).toBe(crc32(data));
  return data.toString("utf8");
}

describe("pageEnd", () => {
  it("takes rows up to the byte budget, and always the first", () => {
    expect(pageEnd([10, 10, 10], 25)).toBe(1);
    expect(pageEnd([100, 1], 25)).toBe(0);
    expect(pageEnd([1, 2, 3], 100)).toBe(2);
  });

  it("splits a page of large rows and still dumps every row", async () => {
    const source = await freshDb();
    const big = "x".repeat(Math.ceil(PAGE_BYTE_BUDGET / 3));
    await source.db.insert(debateCards).values(Array.from({ length: 7 }, (_, i) => ({ id: i + 1, tag: `T${i}`, fulltext: big })));
    const { sql, stats } = await dump(source.db as unknown as BackupDb, ["cards"]);
    expect(stats.tables.debate_cards).toBe(7);
    expect(sql.match(/INSERT OR REPLACE INTO "debate_cards"/g)).toHaveLength(7);
  });
});

describe("createR2Backup", () => {
  it("stores a gzipped dump that matches the plain one", async () => {
    const source = await freshDb();
    await seed(source.db);
    const db = source.db as unknown as BackupDb;
    const { bucket, objects } = fakeBucket();
    const now = new Date("2026-09-28T07:00:00Z");

    const result = await createR2Backup(db, bucket, ["cards"], "manual", now);
    expect(result.backup.key).toBe("db-backups/manual/debate-ai-backup-2026-09-28T07-00-00Z.sql.gz");
    expect(isBackupKey(result.backup.key)).toBe(true);
    expect(result.backup.url).toContain("/api/admin/db-backup/file?key=");
    expect(result.stats.tables.debate_cards).toBe(450);

    const stored = objects.get(result.backup.key)?.data as Uint8Array;
    const { sql } = await dump(db, ["cards"]);
    expect(gunzipSync(stored).toString("utf8")).toBe(sql);
  });

  it("stores a 7z copy of the same dump in KV", async () => {
    const source = await freshDb();
    await seed(source.db);
    const db = source.db as unknown as BackupDb;
    const { bucket } = fakeBucket();
    const { kv, values } = fakeKv();
    const now = new Date("2026-09-28T07:00:00Z");

    const result = await createR2Backup(db, bucket, ["cards"], "manual", now, kv);
    const key = "db-backups/manual/debate-ai-backup-2026-09-28T07-00-00Z.sql.7z";
    expect(result.sevenZipSkipped).toBeNull();
    expect(result.backup.sevenZip).toMatchObject({ key, size: values.get(key)?.data.byteLength });
    expect(isBackupKey(key)).toBe(true);

    const { sql } = await dump(db, ["cards"]);
    expect(unpack7z(values.get(key)!.data)).toBe(sql);

    const listed = await listBackups(bucket, undefined, kv);
    expect(listed[0].sevenZip?.key).toBe(key);

    await deleteBackups(bucket, [result.backup.key], kv);
    expect(values.has(key)).toBe(false);
  });

  it("skips the 7z copy when it would pass the KV limit", async () => {
    const source = await freshDb();
    await seed(source.db);
    const { bucket, objects } = fakeBucket();
    const { kv, values } = fakeKv();

    const result = await createR2Backup(source.db as unknown as BackupDb, bucket, ["cards"], "manual", new Date(), kv, 2048);
    expect(objects.has(result.backup.key)).toBe(true);
    expect(result.backup.sevenZip).toBeNull();
    expect(result.sevenZipSkipped).toMatch(/KV value limit/);
    expect(values.size).toBe(0);
  });

  it("prunes old weekly backups", async () => {
    const source = await freshDb();
    const db = source.db as unknown as BackupDb;
    const { bucket, objects } = fakeBucket();
    for (let week = 0; week < 14; week++) {
      await createR2Backup(db, bucket, ["history"], "weekly", new Date(Date.UTC(2026, 0, 1 + week * 7)));
    }
    expect([...objects.keys()].filter((key) => key.includes("/weekly/")).length).toBeLessThanOrEqual(12);
  });

  it("prunes the 7z copies with their weekly backups", async () => {
    const source = await freshDb();
    const db = source.db as unknown as BackupDb;
    const { bucket, objects } = fakeBucket();
    const { kv, values } = fakeKv();
    for (let week = 0; week < 14; week++) {
      await createR2Backup(db, bucket, ["history"], "weekly", new Date(Date.UTC(2026, 0, 1 + week * 7)), kv);
    }
    const r2Keys = [...objects.keys()].filter((key) => key.includes("/weekly/")).map(sevenZipKey).sort();
    expect([...values.keys()].sort()).toEqual(r2Keys);
  });
});

describe("isBackupKey", () => {
  it("rejects keys outside the backup prefix", () => {
    expect(isBackupKey("db-backups/manual/x.sql.gz")).toBe(true);
    expect(isBackupKey("db-backups/manual/x.sql.7z")).toBe(true);
    expect(isBackupKey("other/x.sql.gz")).toBe(false);
    expect(isBackupKey("db-backups/../secret.sql")).toBe(false);
  });
});
