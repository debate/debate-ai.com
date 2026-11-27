import { count, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import type { AuthorsDataset } from "@debate-ai/help-docs/lib/authors/types";
import snapshot from "../authors-snapshot.json";
import { AUTHORS_DDL } from "../authors-ddl";
import { D1_STATEMENT_LIMIT_BYTES, buildAuthorSeedStatements, sqlText } from "../seed-sql";
import { authors, citationAuthors, citations } from "@/lib/database/schema";
import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";

const dataset = snapshot as unknown as AuthorsDataset;
const bytes = (text: string) => new TextEncoder().encode(text).length;

async function seed(db: Awaited<ReturnType<typeof freshSchemaDb>>, data = dataset) {
  await db.batch(buildAuthorSeedStatements(data).map((statement) => db.run(sql.raw(statement))) as never);
}

describe("sqlText", () => {
  it("doubles single quotes and drops NUL bytes", () => {
    expect(sqlText("O'Kane\0")).toBe("'O''Kane'");
  });
});

describe("buildAuthorSeedStatements", () => {
  const statements = buildAuthorSeedStatements(dataset);

  it("clears the tables child-first, then fills them parent-first", () => {
    expect(statements.slice(0, 3)).toEqual([
      `DELETE FROM "citation_authors"`,
      `DELETE FROM "citations"`,
      `DELETE FROM "authors"`,
    ]);
    const inserted = statements.slice(3).map((statement) => /INSERT INTO "(\w+)"/.exec(statement)![1]);
    expect(inserted[0]).toBe("authors");
    expect(inserted.lastIndexOf("authors")).toBeLessThan(inserted.indexOf("citations"));
    expect(inserted.lastIndexOf("citations")).toBeLessThan(inserted.indexOf("citation_authors"));
  });

  it("keeps every statement under D1's 100 KB limit", () => {
    for (const statement of statements) expect(bytes(statement)).toBeLessThan(D1_STATEMENT_LIMIT_BYTES);
  });

  it("refuses to clear the tables for an empty dataset", () => {
    expect(() => buildAuthorSeedStatements({ ...dataset, authors: [], citations: [] })).toThrow();
  });
});

describe("loading the dataset into SQL", () => {
  it("loads every author, citation and credit, and is idempotent", async () => {
    const db = await freshSchemaDb();
    await seed(db);
    await seed(db);
    const links = dataset.citations.reduce((total, citation) => total + citation.authors.length, 0);
    expect((await db.select({ n: count() }).from(authors))[0]!.n).toBe(dataset.authors.length);
    expect((await db.select({ n: count() }).from(citations))[0]!.n).toBe(dataset.citations.length);
    expect((await db.select({ n: count() }).from(citationAuthors))[0]!.n).toBe(links);
  });

  it("round-trips awkward text (quotes, newlines, unicode) unchanged", async () => {
    const db = await freshSchemaDb();
    const first = dataset.citations[0]!;
    const quoteHtml = "It's \"quoted\"\nand 'multi-line' — Žižek";
    const author = dataset.authors.find((candidate) => candidate.id === first.authors[0]!.authorId)!;
    await seed(db, { ...dataset, authors: [author], citations: [{ ...first, quoteHtml, authors: [first.authors[0]!] }] });
    const [row] = await db.select().from(citations);
    expect(row!.quoteHtml).toBe(quoteHtml);
  });

  it("drops an author or card that left the docs", async () => {
    const db = await freshSchemaDb();
    await seed(db);
    const kept = dataset.authors.slice(0, 10);
    const ids = new Set(kept.map((author) => author.id));
    const trimmed = {
      ...dataset,
      authors: kept,
      citations: dataset.citations
        .map((citation) => ({ ...citation, authors: citation.authors.filter((link) => ids.has(link.authorId)) }))
        .filter((citation) => citation.authors.length > 0),
    };
    await seed(db, trimmed);
    expect((await db.select({ n: count() }).from(authors))[0]!.n).toBe(10);
    expect((await db.select({ n: count() }).from(citations))[0]!.n).toBe(trimmed.citations.length);
  });

  it("leaves the tables untouched when the batch fails partway", async () => {
    const db = await freshSchemaDb();
    await seed(db);
    const broken = [...buildAuthorSeedStatements(dataset), `INSERT INTO "no_such_table" VALUES (1)`];
    await expect(db.batch(broken.map((statement) => db.run(sql.raw(statement))) as never)).rejects.toThrow();
    expect((await db.select({ n: count() }).from(authors))[0]!.n).toBe(dataset.authors.length);
  });
});

describe("AUTHORS_DDL", () => {
  it("creates the columns and indexes schema.ts declares, and is idempotent", async () => {
    const client = createClient({ url: ":memory:" });
    const db = drizzle(client);
    for (const statement of [...AUTHORS_DDL, ...AUTHORS_DDL]) await db.run(sql.raw(statement));
    for (const table of [authors, citations, citationAuthors]) {
      const config = getTableConfig(table);
      const info = await client.execute(`PRAGMA table_info("${config.name}")`);
      expect(info.rows.map((row) => String(row.name)).sort()).toEqual(config.columns.map((column) => column.name).sort());
      const indexes = (await client.execute(`PRAGMA index_list("${config.name}")`)).rows
        .map((row) => String(row.name))
        .filter((name) => name.startsWith("idx_"));
      expect(indexes.sort()).toEqual(config.indexes.map((index) => index.config.name).sort());
    }
  });
});
