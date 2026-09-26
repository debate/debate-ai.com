/**
 * @fileoverview Parses the CSVs written by `src/main.py` into typed rows.
 * @module debate-rankings/parse
 */

import type { FieldStatistics, RankingEntry, SideWinRates } from "./types";

/**
 * Splits CSV text into rows of cells. Handles pandas' quoting (fields with
 * commas are wrapped in `"`, embedded quotes doubled) and CRLF line endings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

/** Parses CSV text into header-keyed records. */
function toRecords(text: string): Record<string, string>[] {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  return body.map((cells) =>
    Object.fromEntries(header.map((key, i) => [key.trim(), cells[i] ?? ""])),
  );
}

/** Empty, `nan` or unparseable cells become `null`. */
function num(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "nan") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function winRates(record: Record<string, string>): SideWinRates {
  return {
    affWinRate: num(record["Aff Win Rate"]),
    negWinRate: num(record["Neg Win Rate"]),
    affElimWinRate: num(record["Aff Elim Win Rate"]),
    negElimWinRate: num(record["Neg Elim Win Rate"]),
  };
}

/**
 * Parses `output/<prefix>full_rankings.csv`. Also accepts the trimmed
 * `<prefix>rankings.csv`, whose "Rating" column is the adjusted rating and
 * which lacks Deviation / Matches / Hash — those fall back to 0 / "".
 */
export function parseFullRankings(text: string): RankingEntry[] {
  return toRecords(text).map((r, i) => {
    const trimmed = !("Adjusted Rating" in r);
    const rating = num(r["Rating"]) ?? 0;
    return {
      rank: num(r["Rank"]) ?? i + 1,
      school: r["School"] ?? "",
      name: r["Name"] ?? "",
      adjustedRating: trimmed ? rating : (num(r["Adjusted Rating"]) ?? 0),
      deviation: num(r["Deviation"]) ?? 0,
      matches: num(r["Matches"]) ?? 0,
      rating,
      hash: r["Hash"] ?? "",
      ...winRates(r),
    };
  });
}

/** Parses `output/<prefix>field_statistics.csv` (one data row). */
export function parseFieldStatistics(text: string): FieldStatistics | null {
  const [record] = toRecords(text);
  return record ? winRates(record) : null;
}
