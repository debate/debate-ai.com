/**
 * @fileoverview Builds the SQL that loads an {@link AuthorsDataset} into the
 * `authors`, `citations` and `citation_authors` tables.
 *
 * Pure strings (no database, no `@/` imports), so the CLI script, the admin
 * route and the tests all load identical data. The statements replace the
 * tables' contents rather than upsert them: the dataset is a projection of the
 * docs, so a card or author that left the docs must leave the tables too, and
 * deleting then inserting handles that without a long `NOT IN (…)` list.
 * Run as one batch (`db.batch` / `client.batch`) the swap is atomic; the
 * `citation_authors` rows are deleted first and inserted last so the foreign
 * keys hold at every step.
 *
 * Values are inlined, so D1's bound-parameter limit does not apply, but its
 * 100 KB statement limit does: inserts are grouped under a byte budget, and a
 * single row that cannot fit makes the builder throw instead of sending D1 a
 * statement it would reject.
 *
 * @module lib/authors/seed-sql
 */
import type { AuthorsDataset } from "@debate-ai/help-docs/lib/authors/types";

/** D1 rejects a statement over 100 KB. */
export const D1_STATEMENT_LIMIT_BYTES = 100_000;

export interface SeedBatchOptions {
  maxRows: number;
  maxBytes: number;
}

export const DEFAULT_SEED_BATCH: SeedBatchOptions = { maxRows: 100, maxBytes: 50_000 };

/** A SQL text literal: single quotes doubled, NUL bytes dropped. */
export function sqlText(value: string): string {
  return `'${value.replace(/\0/g, "").replace(/'/g, "''")}'`;
}

function sqlInt(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "NULL" : String(Math.trunc(value));
}

const byteLength = (text: string) => new TextEncoder().encode(text).length;

/** `INSERT … VALUES` statements for `rows`, each under the byte budget. */
function insertStatements(table: string, columns: readonly string[], rows: readonly string[], options: SeedBatchOptions): string[] {
  const head = `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES\n`;
  const statements: string[] = [];
  let group: string[] = [];
  let bytes = byteLength(head);
  const flush = () => {
    if (group.length > 0) statements.push(`${head}${group.join(",\n")}`);
    group = [];
    bytes = byteLength(head);
  };
  for (const row of rows) {
    const size = byteLength(row) + 2;
    if (group.length > 0 && (group.length >= options.maxRows || bytes + size > options.maxBytes)) flush();
    group.push(row);
    bytes += size;
  }
  flush();
  for (const statement of statements) {
    if (byteLength(statement) > D1_STATEMENT_LIMIT_BYTES) {
      throw new Error(`authors: a ${table} row makes a statement over D1's ${D1_STATEMENT_LIMIT_BYTES}-byte limit`);
    }
  }
  return statements;
}

/**
 * The statements that make the tables hold exactly `dataset`.
 *
 * @throws When the dataset has no authors or no citations: loading it would
 *   empty the tables, which only happens when the docs could not be read.
 */
export function buildAuthorSeedStatements(dataset: AuthorsDataset, options: SeedBatchOptions = DEFAULT_SEED_BATCH): string[] {
  if (dataset.authors.length === 0 || dataset.citations.length === 0) {
    throw new Error("authors: the dataset is empty; refusing to clear the authors tables");
  }

  const authorRows = dataset.authors.map(
    (author) =>
      `(${[
        sqlText(author.id),
        sqlText(author.slug),
        sqlText(author.name),
        sqlText(author.sortName),
        sqlText(author.normalizedName),
        sqlText(author.kind),
        sqlText(author.qualifications),
        sqlText(JSON.stringify(author.aliases)),
        sqlInt(author.cardCount),
        sqlInt(author.quoteCount),
        sqlInt(author.firstYear),
        sqlInt(author.lastYear),
      ].join(", ")})`,
  );

  const citationRows = dataset.citations.map(
    (citation) =>
      `(${[
        sqlText(citation.id),
        sqlText(citation.collection),
        sqlText(citation.collectionTitle),
        sqlText(citation.pagePath),
        sqlText(citation.anchor),
        sqlInt(citation.entryNumber),
        sqlText(citation.chicago),
        sqlText(citation.chicagoText),
        sqlText(citation.year),
        sqlInt(citation.yearNumber),
        sqlText(citation.title),
        sqlText(citation.container),
        sqlText(citation.sourceKind),
        sqlText(citation.url),
        sqlText(citation.summary),
        sqlText(citation.qualification),
        sqlText(citation.quoteHtml),
        sqlText(citation.quoteText),
        sqlInt(citation.quoteWordCount),
        sqlText(citation.quoteStatus),
        citation.etAl ? "1" : "0",
        sqlText(JSON.stringify(citation.citedIn)),
      ].join(", ")})`,
  );

  const linkRows = dataset.citations.flatMap((citation) =>
    citation.authors.map(
      (link) =>
        `(${[sqlText(citation.id), sqlText(link.authorId), sqlInt(link.position), sqlText(link.role), sqlText(link.qualification)].join(", ")})`,
    ),
  );

  return [
    `DELETE FROM "citation_authors"`,
    `DELETE FROM "citations"`,
    `DELETE FROM "authors"`,
    ...insertStatements(
      "authors",
      ["id", "slug", "name", "sort_name", "normalized_name", "kind", "qualifications", "aliases", "card_count", "quote_count", "first_year", "last_year"],
      authorRows,
      options,
    ),
    ...insertStatements(
      "citations",
      [
        "id",
        "collection",
        "collection_title",
        "page_path",
        "anchor",
        "entry_number",
        "chicago",
        "chicago_text",
        "year",
        "year_number",
        "title",
        "container",
        "source_kind",
        "url",
        "summary",
        "qualification",
        "quote_html",
        "quote_text",
        "quote_word_count",
        "quote_status",
        "et_al",
        "cited_in",
      ],
      citationRows,
      options,
    ),
    ...insertStatements("citation_authors", ["citation_id", "author_id", "position", "role", "qualification"], linkRows, options),
  ];
}
