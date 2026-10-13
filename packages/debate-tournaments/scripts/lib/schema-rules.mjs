/**
 * Corrections the converter (`mysql-to-sqlite.mjs`) applies on top of
 * upstream's MySQL schema when it writes the D1 migration, and the overrides
 * the schema doc (`schema-doc.mjs`) reads. Upstream's dump is the source of
 * truth for *which* tables and columns exist; this file (with
 * `relationships.mjs`, the registry of what references what) is where we say
 * what some of them mean, so a fresh upstream pull keeps the fixes.
 */

/** Columns whose upstream type loses data in SQLite: `table.column` → SQLite type. */
export const TYPE_OVERRIDES = {
  // bigint drops a leading "+" or "0"; mediumint drops ZIP leading zeros ("02134").
  "person.phone": "TEXT",
  "chapter.zip": "TEXT",
};

/**
 * Money columns. Upstream mixes decimal(8,2) and float; they all become
 * NUMERIC so every amount has the same affinity. (Integer cents would also
 * need the vendored readers changed, so it is left for later.)
 */
export const MONEY_COLUMNS = new Set([
  "concession.price",
  "event.fee",
  "fine.amount",
  "hotel.surcharge",
  "invoice.total",
  "region_fine.amount",
  "tourn_fee.amount",
]);

/**
 * Explicit CHECK constraints: `table.column` → the condition's right-hand
 * side. Every other `tinyint(1)` column gets `IN (0, 1)` unless it is in
 * `NOT_BOOLEAN`.
 */
export const CHECKS = {
  // 0 = none, 1 = aff/gov, 2 = neg/opp.
  "ballot.side": "IN (0, 1, 2)",
  "rating.side": "IN (0, 1, 2)",
};

/** `tinyint(1)` columns that upstream fills with more than 0 and 1. */
export const NOT_BOOLEAN = new Set(["entry.unconfirmed"]);

/**
 * Columns that must never leave the database. `credential`: password hashes
 * and room passwords. `pii`: a person's contact details and gender. Neither
 * is in a table's public field allowlist (`PUBLIC_COLUMNS` in the generated
 * `columns.ts`), the API strips them from every response, and the
 * sample-data seed blanks them.
 */
export const SENSITIVE = {
  credential: ["person.password", "person.pass_timestamp", "room.password", "room.judge_password"],
  pii: [
    "person.phone",
    "person.street",
    "person.zip",
    "person.postal",
    "person.gender",
    "chapter_judge.phone",
    "chapter_judge.gender",
    "student.gender",
  ],
};

/**
 * Set-membership tables whose (left, right) pair should be unique but has no
 * unique index upstream. The audit reports duplicate pairs; a unique index
 * waits until the data is known to be clean.
 */
export const JUNCTIONS = {
  jpool_judge: ["jpool", "judge"],
  jpool_round: ["jpool", "round"],
  rpool_room: ["rpool", "room"],
  rpool_round: ["rpool", "round"],
  practice_student: ["practice", "student"],
  sweep_include: ["parent", "child"],
};

/**
 * Indexes upstream lacks that the `/api/tabroom` queries need: `EXPLAIN QUERY
 * PLAN` on every query the package's tests issue showed a full-table SCAN
 * without them. (The other scans are list pages over small tables.)
 * `table` → list of column lists.
 */
export const EXTRA_INDEXES = {
  // Tournaments are looked up by slug (`create-tournament.ts`, the invite pages).
  tourn: [["webname"]],
};
