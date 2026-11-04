/**
 * @fileoverview The admin table export: which tables it offers, that it reads
 * every row (no cap), the CSV/JSON encodings, and the multi-file zip.
 */
import JSZip from "jszip";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import type { BackupDb } from "../db-backup";
import {
  csvField,
  EXPORT_TABLES,
  exportTableExists,
  findExportTable,
  listExportTables,
  parseExportTables,
  tableExportFileName,
  tableExportStream,
} from "../table-export";
import { zipFilesStream, zipSingleFileStream } from "../zip";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE videos (video_id TEXT PRIMARY KEY, title TEXT, view_count INTEGER, thumb BLOB)`);
  await client.execute(`CREATE TABLE school_profiles (slug TEXT PRIMARY KEY, name TEXT)`);
  await client.execute(`CREATE TABLE debate_cards (id INTEGER PRIMARY KEY, tag TEXT)`);
  await client.execute(`CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT)`);
  await client.execute(`CREATE TABLE tourn (id INTEGER PRIMARY KEY, name TEXT, start TEXT)`);
  await client.execute(`INSERT INTO debate_cards (tag) VALUES ('card')`);
  await client.execute(`INSERT INTO user VALUES ('u1', 'secret@example.com')`);
  await client.execute(`INSERT INTO school_profiles VALUES ('strath-haven', 'Strath Haven, "PA"')`);
  await client.execute(`INSERT INTO videos VALUES ('abc', 'It''s a round, with commas', 42, X'00ff'), ('def', 'Line
break', NULL, NULL)`);
  return { client, db: drizzle(client) as unknown as BackupDb };
}

const text = async (stream: ReadableStream<Uint8Array>) => new Response(stream).text();

describe("export catalog", () => {
  it("never offers the evidence or account tables", () => {
    const names = EXPORT_TABLES.map((table) => table.name);
    for (const banned of ["debate_cards", "caselist_documents", "evidence_reuse_index", "card_ai_analyses", "user", "session", "account", "person", "saved_rounds"]) {
      expect(names).not.toContain(banned);
    }
    expect(names).toEqual(expect.arrayContaining(["videos", "school_profiles", "tourn", "result_set", "judge_paradigms"]));
  });

  it("parses picked tables, dropping unknown and disallowed names", () => {
    expect(parseExportTables("school_profiles, videos,debate_cards,nope").map((t) => t.name)).toEqual(["videos", "school_profiles"]);
    expect(parseExportTables(null)).toEqual([]);
    expect(findExportTable("user")).toBeUndefined();
  });

  it("lists only the allowed tables this database has, with row counts", async () => {
    const { db } = await freshDb();
    const tables = await listExportTables(db);
    expect(tables).toEqual([
      { name: "videos", group: "videos", rows: 2 },
      { name: "school_profiles", group: "teams", rows: 1 },
      { name: "tourn", group: "records", rows: 0 },
    ]);
    expect(await exportTableExists(db, "videos")).toBe(true);
    expect(await exportTableExists(db, "judge_paradigms")).toBe(false);
  });
});

describe("table export", () => {
  it("writes CSV with a header and RFC 4180 quoting", async () => {
    const { db } = await freshDb();
    const csv = await text(tableExportStream(db, findExportTable("videos")!, "csv"));
    expect(csv).toBe(
      'video_id,title,view_count,thumb\r\nabc,"It\'s a round, with commas",42,00ff\r\ndef,"Line\nbreak",,\r\n',
    );
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("writes JSON as an array of row objects", async () => {
    const { db } = await freshDb();
    const rows = JSON.parse(await text(tableExportStream(db, findExportTable("school_profiles")!, "json")));
    expect(rows).toEqual([{ slug: "strath-haven", name: 'Strath Haven, "PA"' }]);
    expect(JSON.parse(await text(tableExportStream(db, findExportTable("tourn")!, "json")))).toEqual([]);
    expect(await text(tableExportStream(db, findExportTable("tourn")!, "csv"))).toBe("id,name,start\r\n");
  });

  it("exports every row, across many pages, with no cap", async () => {
    const { client, db } = await freshDb();
    const total = 2345; // more than four default pages of 500
    const values = Array.from({ length: total }, (_, i) => `(${i + 1}, 'Tournament ${i + 1}', '2026-01-01')`);
    await client.execute(`INSERT INTO tourn VALUES ${values.join(", ")}`);
    const rows = JSON.parse(await text(tableExportStream(db, findExportTable("tourn")!, "json")));
    expect(rows).toHaveLength(total);
    expect(rows[0].id).toBe(1);
    expect(rows[total - 1].name).toBe(`Tournament ${total}`);
    const csvLines = (await text(tableExportStream(db, findExportTable("tourn")!, "csv"))).trimEnd().split("\r\n");
    expect(csvLines).toHaveLength(total + 1);
  });

  it("names files by table and date", () => {
    expect(tableExportFileName("videos", "csv", new Date("2026-11-04T18:00:00Z"))).toBe("videos-2026-11-04.csv");
  });
});

describe("zipFilesStream", () => {
  it("packs several table exports into one archive", async () => {
    const { db } = await freshDb();
    const zip = zipFilesStream(
      ["videos", "school_profiles", "tourn"].map((name) => ({
        name: `${name}.csv`,
        open: () => tableExportStream(db, findExportTable(name)!, "csv"),
      })),
    );
    const archive = await JSZip.loadAsync(await new Response(zip).arrayBuffer());
    expect(Object.keys(archive.files).sort()).toEqual(["school_profiles.csv", "tourn.csv", "videos.csv"]);
    expect(await archive.file("school_profiles.csv")!.async("string")).toBe('slug,name\r\nstrath-haven,"Strath Haven, ""PA"""\r\n');
    expect(await archive.file("tourn.csv")!.async("string")).toBe("id,name,start\r\n");
  });

  it("still writes a single-file archive that unzips", async () => {
    const zip = zipSingleFileStream("a.txt", new Response("hello").body!);
    const archive = await JSZip.loadAsync(await new Response(zip).arrayBuffer());
    expect(await archive.file("a.txt")!.async("string")).toBe("hello");
  });
});
