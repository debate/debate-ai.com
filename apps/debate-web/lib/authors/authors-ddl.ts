/**
 * @fileoverview The `CREATE TABLE IF NOT EXISTS` statements for the authors
 * tables, with no imports so `.github/scripts/sync-authors.ts` can use them
 * without the app's `@/` alias. `ensure-tables.ts` runs them on a live D1.
 *
 * @module lib/authors/authors-ddl
 */

export const AUTHORS_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "authors" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "sort_name" text NOT NULL,
  "normalized_name" text NOT NULL,
  "kind" text DEFAULT 'person' NOT NULL,
  "qualifications" text DEFAULT '' NOT NULL,
  "aliases" text DEFAULT '[]' NOT NULL,
  "card_count" integer DEFAULT 0 NOT NULL,
  "quote_count" integer DEFAULT 0 NOT NULL,
  "first_year" integer,
  "last_year" integer
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_authors_slug" ON "authors" ("slug")`,
  `CREATE INDEX IF NOT EXISTS "idx_authors_rank" ON "authors" ("card_count", "quote_count")`,
  `CREATE INDEX IF NOT EXISTS "idx_authors_normalized_name" ON "authors" ("normalized_name")`,
  `CREATE TABLE IF NOT EXISTS "citations" (
  "id" text PRIMARY KEY NOT NULL,
  "collection" text NOT NULL,
  "collection_title" text NOT NULL,
  "page_path" text NOT NULL,
  "anchor" text NOT NULL,
  "entry_number" integer NOT NULL,
  "chicago" text NOT NULL,
  "chicago_text" text NOT NULL,
  "year" text DEFAULT '' NOT NULL,
  "year_number" integer,
  "title" text DEFAULT '' NOT NULL,
  "container" text DEFAULT '' NOT NULL,
  "source_kind" text DEFAULT 'other' NOT NULL,
  "url" text DEFAULT '' NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "qualification" text DEFAULT '' NOT NULL,
  "quote_html" text DEFAULT '' NOT NULL,
  "quote_text" text DEFAULT '' NOT NULL,
  "quote_word_count" integer DEFAULT 0 NOT NULL,
  "quote_status" text DEFAULT 'missing' NOT NULL,
  "et_al" integer DEFAULT 0 NOT NULL,
  "cited_in" text DEFAULT '[]' NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "idx_citations_collection" ON "citations" ("collection", "entry_number")`,
  `CREATE TABLE IF NOT EXISTS "citation_authors" (
  "citation_id" text NOT NULL REFERENCES "citations"("id") ON DELETE cascade,
  "author_id" text NOT NULL REFERENCES "authors"("id") ON DELETE cascade,
  "position" integer DEFAULT 0 NOT NULL,
  "role" text DEFAULT 'author' NOT NULL,
  "qualification" text DEFAULT '' NOT NULL,
  PRIMARY KEY ("citation_id", "author_id")
)`,
  `CREATE INDEX IF NOT EXISTS "idx_citation_authors_author" ON "citation_authors" ("author_id", "citation_id")`,
];
