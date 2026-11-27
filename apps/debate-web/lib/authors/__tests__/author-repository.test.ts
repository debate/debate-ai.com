import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import type { AuthorsDataset } from "@debate-ai/help-docs/lib/authors/types";
import snapshot from "../authors-snapshot.json";
import { buildAuthorSeedStatements } from "../seed-sql";
import { listAuthorsFromDataset, profileFromDataset } from "../author-queries";
import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";

const dataset = snapshot as unknown as AuthorsDataset;

let current: unknown;
vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => current }));

async function repository() {
  const { resetEnsuredAuthorTables } = await import("../ensure-tables");
  resetEnsuredAuthorTables();
  return import("../author-repository");
}

describe("author repository", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("falls back to the snapshot when the database is unreachable", async () => {
    current = {
      run: async () => {
        throw new Error("no database");
      },
    };
    const { listAuthors, getAuthorProfile } = await repository();
    const page = await listAuthors({ q: "pinker" });
    expect(page.source).toBe("json");
    expect(page.authors.map((author) => author.slug)).toContain("steven-pinker");
    expect((await getAuthorProfile("steven-pinker"))?.source).toBe("json");
  });

  it("falls back to the snapshot while the tables are empty", async () => {
    current = await freshSchemaDb();
    const { listAuthors, getAuthorProfile } = await repository();
    expect((await listAuthors()).source).toBe("json");
    expect((await getAuthorProfile("steven-pinker"))?.source).toBe("json");
  });

  describe("once seeded", () => {
    beforeEach(async () => {
      const db = await freshSchemaDb();
      await db.batch(buildAuthorSeedStatements(dataset).map((statement) => db.run(sql.raw(statement))) as never);
      current = db;
    });

    it("answers the index from SQL, identically to the snapshot", async () => {
      const { listAuthors } = await repository();
      for (const params of [{}, { page: 3, pageSize: 20 }, { q: "wachowski" }, { q: "zizek" }, { q: "synergy" }, { q: "van munster" }, { q: "nobody-like-this" }]) {
        const fromSql = await listAuthors(params);
        const fromJson = listAuthorsFromDataset(dataset, params);
        expect(fromSql.source).toBe("sql");
        expect({ ...fromSql, source: "json" }).toEqual(fromJson);
      }
    });

    it("answers an author's page from SQL, identically to the snapshot", async () => {
      const { getAuthorProfile } = await repository();
      for (const slug of ["slavoj-zizek", "michael-c-williams", "keith-krause", "cleveland-clinic", "ryan-galloway", "alex-gulakov"]) {
        const fromSql = await getAuthorProfile(slug);
        expect(fromSql?.source).toBe("sql");
        expect({ ...fromSql!, source: "json" }).toEqual(profileFromDataset(dataset, slug));
      }
    });

    it("answers an unknown slug with null, not a fallback", async () => {
      const { getAuthorProfile } = await repository();
      expect(await getAuthorProfile("nobody")).toBeNull();
    });

    it("lists a sitemap entry per author from the snapshot", async () => {
      const { getAuthorSitemapEntries } = await repository();
      const entries = await getAuthorSitemapEntries();
      expect(entries).toHaveLength(dataset.authors.length);
      expect(entries[0]!.path).toMatch(/^\/authors\/[a-z0-9-]+$/);
    });
  });
});
