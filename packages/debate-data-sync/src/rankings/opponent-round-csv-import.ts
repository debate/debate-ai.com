/**
 * @fileoverview Bulk CSV import for scouted opponent rounds — the "a bulk
 * CSV import for scouted rounds" follow-up named under the "🕵️ Opponent
 * Team Profiles" bullet in TODO.md's Research Crowdsourcing Organizer
 * Features list. Independent of that bullet's still-blocked Tabroom-scrape
 * follow-up (see TODO.md's "Confirmed blocker" section): this is a manual
 * upload path for rounds a coach or scout already has in a spreadsheet,
 * mirroring `debate-card-search`'s `parseBulkCardSubmissions` convention of
 * a pure, framework-free parser that reports a skipped-row count/reasons
 * instead of failing the whole batch on one malformed row.
 *
 * A minimal RFC4180-ish CSV reader lives here rather than pulling in a
 * dependency: quoted fields (`"..."`) may contain commas and escaped quotes
 * (`""`), but a field may not contain a literal newline — acceptable for the
 * flat, one-round-per-row export this feature targets.
 *
 * @module rankings/opponent-round-csv-import
 */

import type { DebateSide, OpponentRoundRecord } from "./opponent-team-profile";

/** Header names this importer understands, matched case-insensitively and in any column order. */
const OPPONENT_ROUND_CSV_HEADERS = [
  "teamId",
  "tournamentName",
  "date",
  "division",
  "side",
  "won",
  "argumentTags",
  "caseName",
  "opponentTeamId",
] as const;

type OpponentRoundCsvHeader = (typeof OPPONENT_ROUND_CSV_HEADERS)[number];

const REQUIRED_HEADERS: OpponentRoundCsvHeader[] = [
  "teamId",
  "tournamentName",
  "date",
  "division",
  "side",
  "won",
];

const TRUE_VALUES = new Set(["true", "yes", "y", "1", "win"]);
const FALSE_VALUES = new Set(["false", "no", "n", "0", "loss"]);

/** One parsed row from a bulk opponent-round CSV import. */
export type OpponentRoundCsvEntry = OpponentRoundRecord;

/** Result of parsing a bulk opponent-round CSV import. */
export interface OpponentRoundCsvParseResult {
  entries: OpponentRoundCsvEntry[];
  /** Count of data rows that could not be parsed into a valid round. */
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

/** Splits a semicolon-separated cell into trimmed, non-empty values (used for `argumentTags`). */
function splitMultiValueField(raw: string): string[] {
  return raw
    .split(";")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseWon(raw: string): boolean | null {
  const normalized = raw.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

function parseSide(raw: string): DebateSide | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "aff" || normalized === "neg") return normalized;
  return null;
}

/**
 * Parses a header row into a column-name → index map, matching
 * `OPPONENT_ROUND_CSV_HEADERS` case-insensitively regardless of column
 * order. Returns `null` (rather than throwing) when a required header is
 * missing, so the caller can report one clear error instead of a per-row
 * cascade of "missing column" failures.
 */
function parseHeader(headerLine: string): { columns: Partial<Record<OpponentRoundCsvHeader, number>> } | null {
  const rawHeaders = splitCsvLine(headerLine).map((value) => value.toLowerCase());
  const columns: Partial<Record<OpponentRoundCsvHeader, number>> = {};
  for (const header of OPPONENT_ROUND_CSV_HEADERS) {
    const index = rawHeaders.indexOf(header.toLowerCase());
    if (index !== -1) columns[header] = index;
  }
  const missing = REQUIRED_HEADERS.filter((header) => columns[header] === undefined);
  if (missing.length > 0) return null;
  return { columns };
}

/**
 * Parses a bulk CSV of scouted opponent rounds into `OpponentRoundRecord`s.
 * The first non-blank line must be a header row naming the columns (any
 * order, case-insensitive) from `OPPONENT_ROUND_CSV_HEADERS`; `teamId`,
 * `tournamentName`, `date`, `division`, `side`, and `won` are required,
 * `argumentTags` (semicolon-separated), `caseName`, and `opponentTeamId` are
 * optional. A row missing a required value, or with an unrecognized `side`
 * or `won` value, is skipped and reported in `errors` rather than aborting
 * the whole import.
 *
 * Returns `{ entries: [], skippedCount: 0, errors: [...] }` with one error
 * naming the missing column(s) when the header itself is invalid or absent.
 */
export function parseOpponentRoundRecordsCsv(rawCsv: string): OpponentRoundCsvParseResult {
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

  const entries: OpponentRoundCsvEntry[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
    const rowNumber = rowIndex + 1; // 1-indexed including the header, matching what a spreadsheet shows
    const fields = splitCsvLine(lines[rowIndex]!);
    const get = (name: OpponentRoundCsvHeader): string => {
      const index = columns[name];
      return index === undefined ? "" : (fields[index] ?? "");
    };

    const teamId = get("teamId");
    const tournamentName = get("tournamentName");
    const date = get("date");
    const division = get("division");
    const side = parseSide(get("side"));
    const won = parseWon(get("won"));

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
    if (side === null) {
      errors.push(`Row ${rowNumber}: "side" must be "aff" or "neg", got "${get("side")}".`);
      skippedCount++;
      continue;
    }
    if (won === null) {
      errors.push(`Row ${rowNumber}: "won" must be true/false (or yes/no, 1/0), got "${get("won")}".`);
      skippedCount++;
      continue;
    }

    const argumentTags = splitMultiValueField(get("argumentTags"));
    const caseName = get("caseName");
    const opponentTeamId = get("opponentTeamId");

    entries.push({
      teamId,
      tournamentName,
      date,
      division,
      side,
      won,
      argumentTags: argumentTags.length > 0 ? argumentTags : undefined,
      caseName: caseName === "" ? undefined : caseName,
      opponentTeamId: opponentTeamId === "" ? undefined : opponentTeamId,
    });
  }

  return { entries, skippedCount, errors };
}

/** A minimal example CSV, shown in the panel as the expected format. */
export const OPPONENT_ROUND_CSV_TEMPLATE = [
  "teamId,tournamentName,date,division,side,won,argumentTags,caseName,opponentTeamId",
  "Westlake AB,Berkeley,2026-01-10,PF,aff,true,kritik;topicality,Housing Case,Lincoln CD",
].join("\n");
