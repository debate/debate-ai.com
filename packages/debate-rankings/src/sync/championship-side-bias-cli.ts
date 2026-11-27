/**
 * @fileoverview CLI: refresh `data/championship-side-bias.json` — the aff/neg
 * (PF: pro/con) win counts at each format's championship, overall and in
 * elims — from Tabroom's published ballots.
 *
 *   TABROOM_API_KEY=… bun run sync-side-bias
 *   TABROOM_API_KEY=… bun run sync-side-bias -- --format pf --year 2025
 *
 * Needs `TABROOM_API_KEY` (the `TabroomToken` cookie of a signed-in browser):
 * round ballots are not public. Seasons already in the file and not re-read
 * are kept.
 * @module sync/championship-side-bias-cli
 */

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { SIDE_BIAS_FORMATS, sideBiasYearRange, type SideBiasDataset, type SideBiasFormat } from "../side-bias";
import { syncChampionshipSideBias } from "./championship-side-bias-sync";
import { getTabroomCookie } from "./sync-rankings-ndca";

const { values } = parseArgs({
  options: {
    format: { type: "string", multiple: true },
    year: { type: "string", multiple: true },
    "end-year": { type: "string", default: "2026" },
  },
});

const formats = (values.format ?? SIDE_BIAS_FORMATS) as SideBiasFormat[];
const unknown = formats.filter((f) => !SIDE_BIAS_FORMATS.includes(f));
if (unknown.length > 0) {
  console.error(`unknown format(s): ${unknown.join(", ")}; use ${SIDE_BIAS_FORMATS.join(", ")}`);
  process.exit(1);
}
const years = values.year ? values.year.map(Number) : sideBiasYearRange(Number(values["end-year"]));

const cookie = getTabroomCookie();
if (!cookie) {
  console.error("TABROOM_API_KEY is not set: Tabroom only serves round ballots to a signed-in session.");
  process.exit(1);
}

const output = new URL("../../data/championship-side-bias.json", import.meta.url);
let existing: SideBiasDataset = { generatedAt: null, records: [] };
try {
  existing = JSON.parse(readFileSync(output, "utf8"));
} catch {
  // first run
}

const dataset = await syncChampionshipSideBias({
  fetcher: (input, init) => fetch(input, { ...init, headers: { ...init?.headers, cookie } }),
  formats,
  years,
  existing,
  onProgress: (message) => console.log(message),
});
writeFileSync(output, `${JSON.stringify(dataset, null, 2)}\n`);
console.log(`wrote ${dataset.records.length} season rows`);
