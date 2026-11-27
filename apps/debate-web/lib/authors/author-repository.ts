/**
 * @fileoverview Read side of the authors index.
 *
 * Serves the `/authors` pages from the `authors`, `citations` and
 * `citation_authors` SQL tables (Cloudflare D1 in production, local SQLite via
 * libSQL in development), and falls back to the committed JSON snapshot
 * (`authors-snapshot.json`, written by `.github/scripts/sync-authors.ts`)
 * whenever the tables are missing, unreachable or not yet seeded. Both paths
 * return the same shapes in the same order, so the pages never care which one
 * answered. Seeding moves the reads into SQL: `POST /api/admin/authors/sync`.
 *
 * @module lib/authors/author-repository
 */
import { and, asc, count, desc, eq, like, ne, or, sql, type SQL } from "drizzle-orm";
import type { AuthorRecord, AuthorsDataset, CitationRecord } from "@debate-ai/help-docs/lib/authors/types";
import { getDBFromContext } from "@/lib/database/context";
import { authors, citationAuthors, citations } from "@/lib/database/schema";
import {
  compareCards,
  listAuthorsFromDataset,
  normalizePage,
  normalizePageSize,
  profileFromDataset,
  searchWords,
  toAuthorCard,
  type AuthorListPage,
  type AuthorListParams,
  type AuthorProfile,
  type AuthorsOverview,
  type CoAuthor,
} from "./author-queries";
import { ensureAuthorTables } from "./ensure-tables";

let snapshot: Promise<AuthorsDataset> | undefined;

/** The committed snapshot, loaded once per isolate and only when a read needs it. */
export function loadAuthorsSnapshot(): Promise<AuthorsDataset> {
  snapshot ??= import("./authors-snapshot.json").then((module) => (module.default ?? module) as unknown as AuthorsDataset);
  return snapshot;
}

function parseJson<T>(text: string | null | undefined, fallback: T): T {
  try {
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
}

type AuthorRow = typeof authors.$inferSelect;
type CitationRow = typeof citations.$inferSelect;

function toAuthor(row: AuthorRow): AuthorRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sortName: row.sortName,
    normalizedName: row.normalizedName,
    kind: row.kind === "institution" ? "institution" : "person",
    qualifications: row.qualifications,
    aliases: parseJson<string[]>(row.aliases, []),
    cardCount: row.cardCount,
    quoteCount: row.quoteCount,
    firstYear: row.firstYear,
    lastYear: row.lastYear,
  };
}

function toCitation(row: CitationRow): Omit<CitationRecord, "authors" | "quoteText"> {
  return {
    id: row.id,
    collection: row.collection,
    collectionTitle: row.collectionTitle,
    pagePath: row.pagePath,
    anchor: row.anchor,
    entryNumber: row.entryNumber,
    chicago: row.chicago,
    chicagoText: row.chicagoText,
    year: row.year,
    yearNumber: row.yearNumber,
    title: row.title,
    container: row.container,
    sourceKind: row.sourceKind as CitationRecord["sourceKind"],
    url: row.url,
    summary: row.summary,
    qualification: row.qualification,
    quoteHtml: row.quoteHtml,
    quoteWordCount: row.quoteWordCount,
    quoteStatus: row.quoteStatus as CitationRecord["quoteStatus"],
    etAl: row.etAl === 1,
    citedIn: parseJson(row.citedIn, []),
  };
}

/** Every search word must be in the name or in one of the other spellings. */
function matchFilter(words: readonly string[]): SQL | undefined {
  if (words.length === 0) return undefined;
  return and(
    ...words.map((word) => or(like(authors.normalizedName, `%${word}%`), like(sql`lower(${authors.aliases})`, `%${word}%`))),
  );
}

async function overviewFromDb(db: any): Promise<AuthorsOverview> {
  const [[authorTotal], [citationTotal], [quoted]] = await Promise.all([
    db.select({ n: count() }).from(authors),
    db.select({ n: count() }).from(citations),
    db.select({ n: count() }).from(citations).where(ne(citations.quoteHtml, "")),
  ]);
  return { authors: authorTotal?.n ?? 0, citations: citationTotal?.n ?? 0, citationsWithQuotes: quoted?.n ?? 0 };
}

async function listFromDb(db: any, params: AuthorListParams): Promise<AuthorListPage | null> {
  const overview = await overviewFromDb(db);
  if (overview.authors === 0) return null;

  const filter = matchFilter(searchWords(params.q));
  const [matched] = await db.select({ n: count() }).from(authors).where(filter);
  const total: number = matched?.n ?? 0;
  const pageSize = normalizePageSize(params.pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(normalizePage(params.page), totalPages);

  const rows: AuthorRow[] = await db
    .select()
    .from(authors)
    .where(filter)
    .orderBy(desc(authors.cardCount), desc(authors.quoteCount), asc(authors.sortName), asc(authors.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { authors: rows.map(toAuthor), total, page, pageSize, totalPages, query: (params.q ?? "").trim(), overview, source: "sql" };
}

async function profileFromDb(db: any, slug: string): Promise<AuthorProfile | null> {
  const [row]: AuthorRow[] = await db.select().from(authors).where(eq(authors.slug, slug)).limit(1);
  if (!row) return null;

  const credited: { citation: CitationRow; role: string; qualification: string }[] = await db
    .select({ citation: citations, role: citationAuthors.role, qualification: citationAuthors.qualification })
    .from(citationAuthors)
    .innerJoin(citations, eq(citations.id, citationAuthors.citationId))
    .where(eq(citationAuthors.authorId, row.id));

  const others: { citationId: string; slug: string; name: string; role: string; position: number }[] = await db
    .select({ citationId: citationAuthors.citationId, slug: authors.slug, name: authors.name, role: citationAuthors.role, position: citationAuthors.position })
    .from(citationAuthors)
    .innerJoin(authors, eq(authors.id, citationAuthors.authorId))
    .where(
      and(
        ne(citationAuthors.authorId, row.id),
        sql`${citationAuthors.citationId} IN (SELECT "citation_id" FROM "citation_authors" WHERE "author_id" = ${row.id})`,
      ),
    );

  const coAuthorsByCard = new Map<string, (CoAuthor & { position: number })[]>();
  for (const other of others) {
    const list = coAuthorsByCard.get(other.citationId) ?? [];
    list.push({ slug: other.slug, name: other.name, role: other.role, position: other.position });
    coAuthorsByCard.set(other.citationId, list);
  }

  const cards = credited
    .map(({ citation, role, qualification }) =>
      toAuthorCard(
        toCitation(citation),
        { role, qualification },
        (coAuthorsByCard.get(citation.id) ?? []).sort((a, b) => a.position - b.position).map(({ slug: coSlug, name, role: coRole }) => ({ slug: coSlug, name, role: coRole })),
      ),
    )
    .sort(compareCards);
  return { author: toAuthor(row), cards, source: "sql" };
}

/** Reads from SQL; `undefined` when the tables are unavailable, `null` when SQL answered "no such author". */
async function fromSql<T>(read: (db: any) => Promise<T>): Promise<T | undefined> {
  try {
    const db = await getDBFromContext();
    await ensureAuthorTables(db);
    return await read(db);
  } catch (error) {
    console.error("authors: SQL read failed, using the JSON snapshot", error);
    return undefined;
  }
}

/** A page of the author index, top authors first, optionally narrowed by a name search. */
export async function listAuthors(params: AuthorListParams = {}): Promise<AuthorListPage> {
  const fromDb = await fromSql((db) => listFromDb(db, params));
  return fromDb ?? listAuthorsFromDataset(await loadAuthorsSnapshot(), params);
}

/** One author with every card they are credited on; `null` when there is no such author. */
export async function getAuthorProfile(slug: string): Promise<AuthorProfile | null> {
  const fromDb = await fromSql(async (db) => {
    if ((await overviewFromDb(db)).authors === 0) return undefined;
    return profileFromDb(db, slug);
  });
  if (fromDb !== undefined) return fromDb;
  return profileFromDataset(await loadAuthorsSnapshot(), slug);
}

/** Authors for the sitemap, from the snapshot so the sitemap never waits on SQL. */
export async function getAuthorSitemapEntries(): Promise<{ path: string }[]> {
  const dataset = await loadAuthorsSnapshot();
  return dataset.authors.map((author) => ({ path: `/authors/${author.slug}` }));
}
