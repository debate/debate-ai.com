/**
 * @fileoverview Bulk CSV import for NDCA-style tournament results — the "a
 * manual CSV/paste import for tournament results, since live Tabroom
 * scraping is blocked ... and the old panel's only path in was hand-entry"
 * follow-up named under idea #1 ("CX NDCA Standings") in TODO.md's Product
 * Feature Ideas list. Mirrors `opponent-round-csv-import.ts`'s conventions
 * exactly: a pure, framework-free parser that reports a skipped-row
 * count/reasons instead of failing the whole batch on one malformed row, and
 * the same minimal RFC4180-ish CSV reader (quoted fields may contain commas
 * and escaped quotes, but not a literal newline).
 *
 * @module rankings/tournament-results-csv-import
 */

import type { OutroundFinish, TournamentResult } from "./ndca-standings";

/** Header names this importer understands, matched case-insensitively and in any column order. */
const TOURNAMENT_RESULT_CSV_HEADERS = [
  "teamId",
  "tournamentName",
  "date",
  "division",
  "bidLevel",
  "finish",
  "prelimWins",
  "prelimLosses",
] as const;

type TournamentResultCsvHeader = (typeof TOURNAMENT_RESULT_CSV_HEADERS)[number];

const REQUIRED_HEADERS: TournamentResultCsvHeader[] = [
  "teamId",
  "tournamentName",
  "date",
  "division",
  "finish",
];

const VALID_FINISHES: OutroundFinish[] = [
  "champion",
  "finalist",
  "semifinalist",
  "quarterfinalist",
  "octofinalist",
  "doubleOctofinalist",
  "tripleOctofinalist",
  "prelims",
];
const VALID_FINISH_SET = new Set<string>(VALID_FINISHES);

/** One parsed row from a bulk tournament-results CSV import. */
export type TournamentResultCsvEntry = TournamentResult;

/** Result of parsing a bulk tournament-results CSV import. */
export interface TournamentResultCsvParseResult {
  entries: TournamentResultCsvEntry[];
  /** Count of data rows that could not be parsed into a valid result. */
  skippedCount: number;
  /** One human-readable message per skipped row, in row order. */
  errors: string[];
}

/** Splits one CSV line into raw field strings, honoring `"quoted, fields"` and `""` escaped quotes. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields.map((value) => value.trim());
}

function parseFinish(raw: string): OutroundFinish | null {
  const normalized = raw.trim();
  return VALID_FINISH_SET.has(normalized) ? (normalized as OutroundFinish) : null;
}

/** Parses a non-negative integer, or `null` when the cell is blank (caller supplies a default). */
function parseOptionalNonNegativeInt(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) return null;
  return value;
}

/**
 * Parses a header row into a column-name → index map, matching
 * `TOURNAMENT_RESULT_CSV_HEADERS` case-insensitively regardless of column
 * order. Returns `null` (rather than throwing) when a required header is
 * missing, so the caller can report one clear error instead of a per-row
 * cascade of "missing column" failures.
 */
function parseHeader(
  headerLine: string,
): { columns: Partial<Record<TournamentResultCsvHeader, number>> } | null {
  const rawHeaders = splitCsvLine(headerLine).map((value) => value.toLowerCase());
  const columns: Partial<Record<TournamentResultCsvHeader, number>> = {};
  for (const header of TOURNAMENT_RESULT_CSV_HEADERS) {
    const index = rawHeaders.indexOf(header.toLowerCase());
    if (index !== -1) columns[header] = index;
  }
  const missing = REQUIRED_HEADERS.filter((header) => columns[header] === undefined);
  if (missing.length > 0) return null;
  return { columns };
}

/**
 * Parses a bulk CSV of tournament results into `TournamentResult`s. The
 * first non-blank line must be a header row naming the columns (any order,
 * case-insensitive) from `TOURNAMENT_RESULT_CSV_HEADERS`; `teamId`,
 * `tournamentName`, `date`, `division`, and `finish` are required,
 * `bidLevel`/`prelimWins`/`prelimLosses` are optional and default to `0`. A
 * row missing a required value, with an unrecognized `finish`, or with a
 * non-numeric/negative `bidLevel`/`prelimWins`/`prelimLosses`, is skipped and
 * reported in `errors` rather than aborting the whole import.
 *
 * Returns `{ entries: [], skippedCount: 0, errors: [...] }` with one error
 * naming the missing column(s) when the header itself is invalid or absent.
 */
export function parseTournamentResultsCsv(rawCsv: string): TournamentResultCsvParseResult {
  const lines = rawCsv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { entries: [], skippedCount: 0, errors: ["The CSV is empty."] };
  }

  const header = parseHeader(lines[0]!);
  if (!header) {
    return {
      entries: [],
      skippedCount: 0,
      errors: [
        `Header row is missing one or more required columns: ${REQUIRED_HEADERS.join(", ")}.`,
      ],
    };
  }
  const { columns } = header;

  const entries: TournamentResultCsvEntry[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
    const rowNumber = rowIndex + 1; // 1-indexed including the header, matching what a spreadsheet shows
    const fields = splitCsvLine(lines[rowIndex]!);
    const get = (name: TournamentResultCsvHeader): string => {
      const index = columns[name];
      return index === undefined ? "" : (fields[index] ?? "");
    };

    const teamId = get("teamId");
    const tournamentName = get("tournamentName");
    const date = get("date");
    const division = get("division");
    const finish = parseFinish(get("finish"));

    const missingFields = [
      !teamId && "teamId",
      !tournamentName && "tournamentName",
      !date && "date",
      !division && "division",
    ].filter((value): value is string => Boolean(value));

    if (missingFields.length > 0) {
      errors.push(`Row ${rowNumber}: missing required field(s): ${missingFields.join(", ")}.`);
      skippedCount++;
      continue;
    }
    if (finish === null) {
      errors.push(
        `Row ${rowNumber}: "finish" must be one of ${VALID_FINISHES.join(", ")}, got "${get("finish")}".`,
      );
      skippedCount++;
      continue;
    }

    const bidLevel = parseOptionalNonNegativeInt(get("bidLevel"));
    if (bidLevel === null) {
      errors.push(`Row ${rowNumber}: "bidLevel" must be a non-negative whole number, got "${get("bidLevel")}".`);
      skippedCount++;
      continue;
    }
    const prelimWins = parseOptionalNonNegativeInt(get("prelimWins"));
    if (prelimWins === null) {
      errors.push(
        `Row ${rowNumber}: "prelimWins" must be a non-negative whole number, got "${get("prelimWins")}".`,
      );
      skippedCount++;
      continue;
    }
    const prelimLosses = parseOptionalNonNegativeInt(get("prelimLosses"));
    if (prelimLosses === null) {
      errors.push(
        `Row ${rowNumber}: "prelimLosses" must be a non-negative whole number, got "${get("prelimLosses")}".`,
      );
      skippedCount++;
      continue;
    }

    entries.push({
      teamId,
      tournamentName,
      date,
      division,
      finish,
      bidLevel: bidLevel ?? 0,
      prelimWins: prelimWins ?? 0,
      prelimLosses: prelimLosses ?? 0,
    });
  }

  return { entries, skippedCount, errors };
}

/** A minimal example CSV, shown in the panel as the expected format. */
export const TOURNAMENT_RESULT_CSV_TEMPLATE = [
  "teamId,tournamentName,date,division,bidLevel,finish,prelimWins,prelimLosses",
  "Westlake AB,Berkeley,2026-01-10,PF,1,quarterfinalist,5,1",
].join("\n");
