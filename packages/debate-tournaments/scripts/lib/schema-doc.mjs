/**
 * Renders `packages/dev-docs/tabroom-schema.md`, the column-by-column
 * reference for the generated Tabroom tables.
 *
 * Types, constraints and indexes come from the rules-applied schema, so they
 * always match the migration. The prose — each table's one-line description
 * and each column's purpose — is hand-written and lives in the doc itself:
 * the renderer reads the previous doc and carries it forward, so edit the
 * markdown to improve a description and it survives the next sync.
 *
 * The one thing the renderer decides is which columns are references. A
 * purpose of "References `x.id`." is only kept or written for a column
 * `referenceTarget` accepts (an INTEGER named after a table, with the
 * exceptions in `schema-rules.mjs`); `PURPOSE_OVERRIDES` replaces purposes
 * the old name-matching guessed wrong.
 */

/** Purposes that replace whatever the doc said: `table.column` → text ("" for none). */
export const PURPOSE_OVERRIDES = {
  "person.email": "Email address (unique).",
  "chapter_judge.email": "Email address.",
  "score.topic": "Topic text the score was given on (not a `topic.id`).",
  "qualifier.result": "Qualification result text (not a `result.id`).",
  "tiebreak.result": "Which result the tiebreak counts, e.g. `win` (not a `result.id`).",
  "topic.pattern": "Resolution pattern text (not a `pattern.id`).",
  "autoqueue.message": "Message text sent when the action runs (not a `message.id`).",
  "rating_tier.strike": "Flag: this tier counts as a strike.",
  "rating_tier.conflict": "Flag: this tier counts as a conflict.",
  "judge.score": "Judge rating score (not a `score.id`).",
  "file.coach": "Flag: visible to coaches only.",
  "result_set.coach": "Flag: visible to coaches only.",
  "follower.follower": "Not a `follower.id`; upstream gives no detail.",
  "shift.fine": "Fine amount for missing the shift (not a `fine.id`).",
  "contact.email": "Flag: receives tournament email.",
  "score.value": "The score itself (speaker points, rank or win), by `tag`.",
  "stats.value": "The statistic's value, by `tag`.",
  "result_value.value": "The cell's value.",
  "student_vote.value": "The vote (a rank or yes/no), by `tag`.",
  "round.name": "Round number within the event (upstream calls it `name`; `label` is the display name).",
};

const REFERENCE_RE = /`(\w+)\.id`/;

/** Reads `### table` sections of a previous doc: description and column purposes. */
function parseDoc(markdown) {
  const tables = new Map();
  let current = null;
  for (const line of markdown.split("\n")) {
    const heading = line.match(/^### (\w+)$/);
    if (heading) {
      current = { description: "", purposes: new Map() };
      tables.set(heading[1], current);
      continue;
    }
    if (!current) continue;
    const row = line.match(/^\| `([^`]+)` \| [^|]* \| [^|]* \| (.*) \|$/);
    if (row) current.purposes.set(row[1], row[2].trim());
    else if (line && !line.startsWith("|") && !line.startsWith("Indexes:") && !line.startsWith("#") && !current.description) {
      current.description = line;
    }
  }
  return tables;
}

function constraints(table, col) {
  if (table.primaryKey.length === 1 && table.primaryKey[0] === col.name && col.autoIncrement) return "PK";
  const parts = [];
  if (table.primaryKey.includes(col.name)) parts.push("PK");
  if (col.notNull) parts.push("NOT NULL");
  if (col.default !== null && col.default !== "NULL") parts.push(`DEFAULT ${col.default}`);
  if (col.check) parts.push(`CHECK ${col.check}`);
  return parts.join(" ");
}

function purpose(table, col, previous) {
  const key = `${table.name}.${col.name}`;
  if (key in PURPOSE_OVERRIDES) return PURPOSE_OVERRIDES[key];
  const prev = previous ?? "";
  const named = prev.match(REFERENCE_RE)?.[1];
  if (col.reference) {
    let text = named === col.reference ? prev : `References \`${col.reference}.id\`.`;
    if (col.sentinel && !/NULL/.test(text)) text += " NULL when none.";
    return text;
  }
  // Not a reference: drop a guessed "References `x.id`" and setting-table wording elsewhere.
  if (named) return "";
  if (/^Setting value/.test(prev) && !/(^|_)setting$/.test(table.name)) return "";
  return prev;
}

const escapeCell = (text) => text.replace(/\|/g, "\\|");

/**
 * The full markdown for `tabroom-schema.md`.
 * @param {ReturnType<import("./mysql-to-sqlite.mjs").applySchemaRules>} tables the tables the migration creates
 * @param {string} previousMarkdown the current doc, for its prose
 * @param {{ skipTables?: string[] }} [options]
 */
export function renderSchemaDoc(tables, previousMarkdown, { skipTables = [] } = {}) {
  const prose = parseDoc(previousMarkdown);
  const out = [
    "# Tabroom tournament schema",
    "",
    `The ${tables.length} tables behind \`/tournaments\` and \`/api/tabroom\`, vendored from upstream`,
    "[Tabroom](https://github.com/debate/debate-tournament-tabroom) by `packages/debate-tournaments`.",
    "They live in the same D1 database as the app tables but are not in `schema.ts`: they are created by",
    "`packages/debate-tournaments/migrations/0001_tabroom_schema.sql`, which is generated by",
    "`packages/debate-tournaments/scripts/sync-upstream.mjs`. Do not edit that SQL by hand; change the",
    "converter (`scripts/lib/schema-rules.mjs` holds the corrections) or upstream. Databases that ran an",
    "earlier 0001 are brought up to date by the generated `*_tabroom_schema_upgrade.sql` migrations.",
    `Upstream's ${skipTables.map((t) => `\`${t}\``).join(", ")} tables are skipped. Demo data: \`bun run db:seed:tournaments\`.`,
    "",
    "This page is generated too, by `scripts/lib/schema-doc.mjs` on every sync. Types, constraints and",
    "indexes come from the schema; table descriptions and column purposes are carried over from this",
    "file, so edit them here.",
    "",
    "These tables are separate from the app's accounts: `person` is a Tabroom person, not a `user` row.",
    "",
    "Every column is listed. A blank purpose means the column name is the whole story upstream gives;",
    "upstream Tabroom is the reference for those.",
    "",
    "## Conventions",
    "",
    "- **References** are plain `INTEGER` columns named after the table they point at: `tourn` holds a",
    "  `tourn.id`, `judge` a `judge.id`, `person` a `person.id`; `*_by` columns and `last_editor` hold a",
    "  `person.id`. Text columns and `0`/`1` flags are never references, even when named after a table.",
    "  The SQL declares no foreign keys (upstream data has orphan rows); most reference columns are",
    "  indexed instead (index names are `<table>__<index>`), and `bun run db:check:tournaments` reports",
    "  orphans. A missing reference is `NULL`: upstream's `DEFAULT 0` \"none\" sentinels are rewritten.",
    "- **Flags** (`tinyint(1)` upstream) are `INTEGER` with `CHECK (col IN (0, 1))`; `side` is 0 (none),",
    "  1 or 2.",
    "- **Money** (`fee`, `amount`, `price`, `total`, `surcharge`) is `NUMERIC`, in the tournament's currency.",
    "- **`*_setting` tables** are key/value stores for their parent row: `tag` is the key, `value` /",
    "  `value_text` / `value_date` hold the value, and `setting` points at the `setting` catalog.",
    "- **`timestamp`** is the last-modified time; `created_at` the creation time. Dates are ISO text.",
    "- Upstream hierarchy: `circuit` > `tourn` > `event` > `round` > `panel` (a room) > `ballot` > `score`;",
    "  `school` (a tournament registration of a `chapter`) > `entry` > `entry_student` > `student`; `category` > `judge`.",
    "",
    "## Tables",
    "",
    tables.map((t) => `[\`${t.name}\`](#${t.name})`).join(", "),
  ];
  for (const table of tables) {
    const previous = prose.get(table.name);
    out.push("", `### ${table.name}`, "");
    if (previous?.description) out.push(previous.description, "");
    out.push("| Column | Type | Constraints | Purpose |", "| --- | --- | --- | --- |");
    for (const col of table.columns) {
      const text = purpose(table, col, previous?.purposes.get(col.name));
      out.push(`| \`${col.name}\` | ${col.type} | ${escapeCell(constraints(table, col))} | ${escapeCell(text)} |`);
    }
    if (table.indexes.length) {
      const list = table.indexes.map(
        (ix) => `\`${table.name}__${ix.name}\`${ix.unique ? " (unique)" : ""} on (${ix.columns.join(", ")})`,
      );
      out.push("", `Indexes: ${list.join("; ")}`);
    }
  }
  return `${out.join("\n")}\n`;
}
