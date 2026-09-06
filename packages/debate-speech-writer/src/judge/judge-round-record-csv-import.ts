/**
 * @fileoverview Bulk CSV import for judged rounds (ballot history) — the
 * "a bulk CSV import for ballot history" follow-up named under the "⚖️ Judge
 * Profiles" bullet in TODO.md's Research Crowdsourcing Organizer Features
 * list. That bullet's note misfiled this as blocked behind the same
 * Tabroom-login-wall gap as the live tournament-results scrape (see TODO.md's
 * "Confirmed blocker" section): it isn't — like Opponent Team Profiles' own
 * `rankings/opponent-round-csv-import.ts`, this is a manual upload path for
 * ballots a coach or scout already has in a spreadsheet, independent of any
 * live Tabroom fetch. This module mirrors that file's structure line for
 * line: a dependency-free RFC4180-ish CSV reader, header matched
 * case-insensitively in any column order, and a skipped-row count/reasons
 * instead of failing the whole batch on one malformed row.
 *
 * @module judge/judge-round-record-csv-import
 */

import type { DebateSide, JudgeRoundRecord } from "./judge-profile";
import { judgeParadigmIds, type BuiltinJudgeParadigmId } from "./judge-paradigms";

/** Header names this importer understands, matched case-insensitively and in any column order. */
const JUDGE_ROUND_CSV_HEADERS = [
  "judgeId",
  "tournamentName",
  "date",
  "division",
  "winningSide",
  "affSpeakerPoints",
  "negSpeakerPoints",
  "paceWpm",
  "theoryArgumentRaised",
  "theoryArgumentWon",
  "paradigmId",
] as const;

type JudgeRoundCsvHeader = (typeof JUDGE_ROUND_CSV_HEADERS)[number];

const REQUIRED_HEADERS: JudgeRoundCsvHeader[] = [
  "judgeId",
  "tournamentName",
  "date",
  "division",
  "winningSide",
  "affSpeakerPoints",
  "negSpeakerPoints",
];

const TRUE_VALUES = new Set(["true", "yes", "y", "1"]);
const FALSE_VALUES = new Set(["false", "no", "n", "0"]);

/** One parsed row from a bulk judge-round CSV import. */
export type JudgeRoundCsvEntry = JudgeRoundRecord;

/** Result of parsing a bulk judge-round CSV import. */
export interface JudgeRoundCsvParseResult {
  entries: JudgeRoundCsvEntry[];
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

function parseBoolean(raw: string): boolean | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "") return false;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

function parseSide(raw: string): DebateSide | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "aff" || normalized === "neg") return normalized;
  return null;
}

function parseParadigm(raw: string): { ok: true; value: BuiltinJudgeParadigmId | undefined } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: undefined };
  const normalized = trimmed.toLowerCase();
  const match = judgeParadigmIds.find((id) => id.toLowerCase() === normalized);
  return match ? { ok: true, value: match } : { ok: false };
}

/**
 * Parses a header row into a column-name → index map, matching
 * `JUDGE_ROUND_CSV_HEADERS` case-insensitively regardless of column order.
 * Returns `null` (rather than throwing) when a required header is missing,
 * so the caller can report one clear error instead of a per-row cascade of
 * "missing column" failures.
 */
function parseHeader(headerLine: string): { columns: Partial<Record<JudgeRoundCsvHeader, number>> } | null {
  const rawHeaders = splitCsvLine(headerLine).map((value) => value.toLowerCase());
  const columns: Partial<Record<JudgeRoundCsvHeader, number>> = {};
  for (const header of JUDGE_ROUND_CSV_HEADERS) {
    const index = rawHeaders.indexOf(header.toLowerCase());
    if (index !== -1) columns[header] = index;
  }
  const missing = REQUIRED_HEADERS.filter((header) => columns[header] === undefined);
  if (missing.length > 0) return null;
  return { columns };
}

/**
 * Parses a bulk CSV of judged rounds (ballot history) into
 * `JudgeRoundRecord`s. The first non-blank line must be a header row naming
 * the columns (any order, case-insensitive) from `JUDGE_ROUND_CSV_HEADERS`;
 * `judgeId`, `tournamentName`, `date`, `division`, `winningSide`,
 * `affSpeakerPoints`, and `negSpeakerPoints` are required, `paceWpm`,
 * `theoryArgumentRaised`, `theoryArgumentWon`, and `paradigmId` are optional.
 * A row missing a required value, with an unrecognized `winningSide`/boolean/
 * `paradigmId`, or a non-numeric points/pace value, is skipped and reported
 * in `errors` rather than aborting the whole import.
 *
 * Returns `{ entries: [], skippedCount: 0, errors: [...] }` with one error
 * naming the missing column(s) when the header itself is invalid or absent.
 */
export function parseJudgeRoundRecordsCsv(rawCsv: string): JudgeRoundCsvParseResult {
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

  const entries: JudgeRoundCsvEntry[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
    const rowNumber = rowIndex + 1; // 1-indexed including the header, matching what a spreadsheet shows
    const fields = splitCsvLine(lines[rowIndex]!);
    const get = (name: JudgeRoundCsvHeader): string => {
      const index = columns[name];
      return index === undefined ? "" : (fields[index] ?? "");
    };

    const judgeId = get("judgeId");
    const tournamentName = get("tournamentName");
    const date = get("date");
    const division = get("division");
    const winningSide = parseSide(get("winningSide"));

    const missingFields = [
      !judgeId && "judgeId",
      !tournamentName && "tournamentName",
      !date && "date",
      !division && "division",
    ].filter((value): value is string => Boolean(value));

    if (missingFields.length > 0) {
      errors.push(`Row ${rowNumber}: missing required field(s): ${missingFields.join(", ")}.`);
      skippedCount++;
      continue;
    }
    if (winningSide === null) {
      errors.push(`Row ${rowNumber}: "winningSide" must be "aff" or "neg", got "${get("winningSide")}".`);
      skippedCount++;
      continue;
    }

    const affSpeakerPoints = Number(get("affSpeakerPoints"));
    const negSpeakerPoints = Number(get("negSpeakerPoints"));
    if (get("affSpeakerPoints").trim() === "" || !Number.isFinite(affSpeakerPoints)) {
      errors.push(`Row ${rowNumber}: "affSpeakerPoints" must be a number, got "${get("affSpeakerPoints")}".`);
      skippedCount++;
      continue;
    }
    if (get("negSpeakerPoints").trim() === "" || !Number.isFinite(negSpeakerPoints)) {
      errors.push(`Row ${rowNumber}: "negSpeakerPoints" must be a number, got "${get("negSpeakerPoints")}".`);
      skippedCount++;
      continue;
    }

    const rawPace = get("paceWpm").trim();
    const paceWpm = rawPace === "" ? undefined : Number(rawPace);
    if (paceWpm !== undefined && !Number.isFinite(paceWpm)) {
      errors.push(`Row ${rowNumber}: "paceWpm" must be a number, got "${rawPace}".`);
      skippedCount++;
      continue;
    }

    const theoryArgumentRaised = parseBoolean(get("theoryArgumentRaised"));
    if (theoryArgumentRaised === null) {
      errors.push(
        `Row ${rowNumber}: "theoryArgumentRaised" must be true/false (or yes/no, 1/0), got "${get("theoryArgumentRaised")}".`,
      );
      skippedCount++;
      continue;
    }
    const theoryArgumentWonRaw = parseBoolean(get("theoryArgumentWon"));
    if (theoryArgumentWonRaw === null) {
      errors.push(
        `Row ${rowNumber}: "theoryArgumentWon" must be true/false (or yes/no, 1/0), got "${get("theoryArgumentWon")}".`,
      );
      skippedCount++;
      continue;
    }

    const paradigm = parseParadigm(get("paradigmId"));
    if (!paradigm.ok) {
      errors.push(
        `Row ${rowNumber}: "paradigmId" must be one of ${judgeParadigmIds.join(", ")} or left blank, got "${get("paradigmId")}".`,
      );
      skippedCount++;
      continue;
    }

    entries.push({
      judgeId,
      tournamentName,
      date,
      division,
      winningSide,
      affSpeakerPoints,
      negSpeakerPoints,
      paceWpm,
      // Won-but-never-raised isn't a real state, mirroring the panel form's own rule.
      theoryArgumentRaised,
      theoryArgumentWon: theoryArgumentRaised && theoryArgumentWonRaw,
      paradigmId: paradigm.value,
    });
  }

  return { entries, skippedCount, errors };
}

/** A minimal example CSV, shown in the panel as the expected format. */
export const JUDGE_ROUND_CSV_TEMPLATE = [
  "judgeId,tournamentName,date,division,winningSide,affSpeakerPoints,negSpeakerPoints,paceWpm,theoryArgumentRaised,theoryArgumentWon,paradigmId",
  "smith,Berkeley,2026-01-10,PF,aff,28.5,28,320,true,false,flow",
].join("\n");
