/**
 * Corrections the converter (`mysql-to-sqlite.mjs`) applies on top of
 * upstream's MySQL schema when it writes the D1 migration, and the overrides
 * the schema doc (`schema-doc.mjs`) reads. Upstream's dump is the source of
 * truth for *which* tables and columns exist; this file is where we say what
 * some of them mean, so a fresh upstream pull keeps the fixes.
 */

/**
 * Columns that look like references but are not.
 *
 * The default rule is "an INTEGER column named after a table holds that
 * table's id". These match a table name and are INTEGER, yet hold a score,
 * an amount or a person rather than that table's id. (`tinyint(1)` flags such
 * as `rating_tier.strike` or `file.coach` are excluded by type already.)
 */
export const NOT_REFERENCES = new Set(["judge.score", "follower.follower", "shift.fine"]);

/** Reference columns not named after the table they point at: column → table. */
export const REFERENCE_COLUMNS = {
  added_by: "person",
  approved_by: "person",
  audited_by: "person",
  created_by: "person",
  deleted_by: "person",
  entered_by: "person",
  last_editor: "person",
  levied_by: "person",
  registered_by: "person",
  started_by: "person",
};

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
 * Columns the sample-data seed blanks: upstream's dump carries real password
 * hashes, which must never reach a database we load it into.
 */
export const SEED_NULL_COLUMNS = ["person.password", "room.password", "room.judge_password"];

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
