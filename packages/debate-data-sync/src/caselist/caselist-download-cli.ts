/**
 * @fileoverview Pick openCaselist bulk ZIPs — the whole-season dump, every
 * weekly archive, one week, or a date range — and download them with
 * `grab-url`.
 *
 * Run from the repo root:
 *
 * ```bash
 * bun run --cwd packages/debate-data-sync download-caselist                 # interactive, hspolicy26
 * bun run --cwd packages/debate-data-sync download-caselist -- --caselist=hsld26
 * bun run --cwd packages/debate-data-sync download-caselist -- --select=a
 * bun run --cwd packages/debate-data-sync download-caselist -- --select=w --out=zips
 * bun run --cwd packages/debate-data-sync download-caselist -- --select=r --from=2026-08-01 --to=2026-09-22
 * bun run --cwd packages/debate-data-sync download-caselist -- --select=2026-09-08 --dry-run
 * ```
 *
 * The menu, as the interactive prompt shows it:
 *
 * | Answer            | Downloads                                             |
 * |-------------------|-------------------------------------------------------|
 * | `A`               | the latest all-files (season) archive                 |
 * | `W`               | every weekly archive                                  |
 * | `R`               | weekly archives between two inclusive ISO dates       |
 * | `1`, `2`, …       | one weekly archive, by its number in the list         |
 * | `YYYY-MM-DD`      | the weekly archive cut on that date                   |
 *
 * The archive list comes from {@link fetchCaselistDownloads}, not from a
 * regex over the downloads page: that page is a client-rendered shell whose
 * served HTML links no ZIPs, so discovery tries the page's API, then the
 * markup, then probes the file bucket for each Tuesday's archive. A page
 * saved out of a browser can still be supplied with `--html-file`. The
 * probe looks back over the whole season (see {@link seasonProbeWeeks}), not
 * just the last eight weeks the sync checks, so July's archives are offered
 * in September too.
 *
 * @module caselist/caselist-download-cli
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, promises as fs } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { CURRENT_SEASON, parseCaselistSlug } from "./caselist-config";
import { fetchCaselistDownloads } from "./caselist-sync";
import type { CaselistArchive, CaselistDownloads } from "./downloads-page-parser";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** What to download. */
export type Selection =
  | { mode: "all" }
  | { mode: "weekly" }
  | { mode: "range"; from?: string; to?: string }
  | { mode: "index"; index: number }
  | { mode: "date"; date: string };

/** Parsed command line. */
export interface DownloadOptions {
  slug: string;
  /** Unset means ask interactively. */
  selection?: Selection;
  outDir: string;
  htmlFile?: string;
  /** Tuesdays to probe the bucket for; defaults to the whole season so far. */
  weeks?: number;
  dryRun: boolean;
}

/**
 * How many Tuesdays back reach the start of a caselist's season — July 1 of
 * its opening year, when the first weekly archives appear.
 *
 * @param slug - Caselist slug, e.g. `hspolicy26`.
 * @param now - The date to count back from.
 * @returns At least 8 (the sync's own window), at most a year of weeks.
 */
export function seasonProbeWeeks(slug: string, now: Date = new Date()): number {
  const caselist = parseCaselistSlug(slug);
  if (!caselist) return 8;
  const seasonStart = Date.UTC(caselist.year, 6, 1);
  const weeks = Math.ceil((now.getTime() - seasonStart) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.min(53, Math.max(8, weeks));
}

/**
 * Reads one menu answer — `a`, `w`, `r`, a list number or a date.
 *
 * @param answer - What was typed, or the `--select` value.
 * @param range - Bounds for `r`, when already known.
 * @returns The selection, or `null` for an answer the menu doesn't offer.
 */
export function parseSelection(
  answer: string,
  range: { from?: string; to?: string } = {},
): Selection | null {
  const value = answer.trim().toLowerCase();
  if (value === "a" || value === "all") return { mode: "all" };
  if (value === "w" || value === "weekly") return { mode: "weekly" };
  if (value === "r" || value === "range") return { mode: "range", ...range };
  if (ISO_DATE.test(value)) return { mode: "date", date: value };
  if (/^\d+$/.test(value)) {
    const index = Number.parseInt(value, 10) - 1;
    return index >= 0 ? { mode: "index", index } : null;
  }
  return null;
}

/**
 * Resolves a selection against a caselist's archives.
 *
 * @param downloads - The caselist's season dump and weekly archives (newest first).
 * @param selection - What was asked for.
 * @returns The archives to download, newest first.
 * @throws When the selection names something the caselist doesn't have, or a
 *   range bound is not an ISO date.
 */
export function selectArchives(downloads: CaselistDownloads, selection: Selection): CaselistArchive[] {
  const weekly = downloads.weekly;
  switch (selection.mode) {
    case "all":
      if (!downloads.all) throw new Error("No all-files archive was found for this caselist.");
      return [downloads.all];
    case "weekly":
      return weekly;
    case "range": {
      for (const bound of [selection.from, selection.to]) {
        if (bound && !ISO_DATE.test(bound)) throw new Error(`"${bound}" is not a YYYY-MM-DD date.`);
      }
      return weekly.filter(
        ({ date }) => (!selection.from || date >= selection.from) && (!selection.to || date <= selection.to),
      );
    }
    case "index": {
      const archive = weekly[selection.index];
      if (!archive) throw new Error(`There is no weekly archive #${selection.index + 1}.`);
      return [archive];
    }
    case "date": {
      const archive = weekly.find(({ date }) => date === selection.date);
      if (!archive) throw new Error(`There is no weekly archive dated ${selection.date}.`);
      return [archive];
    }
  }
}

/**
 * Parses the command line.
 *
 * @param argv - Arguments after the script name.
 * @returns The run's options.
 * @throws On a `--select` the menu doesn't offer.
 */
export function parseDownloadArgs(argv: readonly string[]): DownloadOptions {
  const value = (flag: string): string | undefined => {
    const hit = argv.find((arg) => arg === flag || arg.startsWith(`${flag}=`));
    if (!hit) return undefined;
    if (hit.includes("=")) return hit.slice(hit.indexOf("=") + 1);
    return argv[argv.indexOf(hit) + 1];
  };

  const select = value("--select");
  const from = value("--from");
  const to = value("--to");
  let selection: Selection | undefined;
  if (select !== undefined) {
    selection = parseSelection(select, { from, to }) ?? undefined;
    if (!selection) throw new Error(`--select=${select} is not one of a, w, r, a list number or a YYYY-MM-DD date.`);
  } else if (from || to) {
    selection = { mode: "range", from, to };
  }

  return {
    slug: value("--caselist") ?? `hspolicy${CURRENT_SEASON}`,
    selection,
    outDir: value("--out") ?? ".",
    htmlFile: value("--html-file"),
    weeks: value("--weeks") ? Number.parseInt(value("--weeks") as string, 10) : undefined,
    dryRun: argv.includes("--dry-run"),
  };
}

/** Prints the menu the interactive prompt answers. */
function printMenu(downloads: CaselistDownloads): void {
  console.log(`\n${downloads.label} ZIP archives\n`);
  if (downloads.all) console.log(`A. Latest all-files archive: ${downloads.all.fileName}`);
  console.log("W. Download every weekly archive");
  console.log("R. Download weekly archives in a date range");
  console.log("Enter a number (or a YYYY-MM-DD date) to download one weekly archive:\n");
  downloads.weekly.forEach((archive, index) => {
    console.log(`${index + 1}. ${archive.date} — ${archive.fileName}`);
  });
}

/** Asks for a selection on the terminal. */
async function promptSelection(downloads: CaselistDownloads): Promise<Selection> {
  printMenu(downloads);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question("\nSelection: ");
    const selection = parseSelection(answer);
    if (!selection) throw new Error("Invalid selection.");
    if (selection.mode === "range") {
      selection.from = (await rl.question("Start date (YYYY-MM-DD; blank = earliest): ")).trim() || undefined;
      selection.to = (await rl.question("End date (YYYY-MM-DD; blank = latest): ")).trim() || undefined;
    }
    return selection;
  } finally {
    rl.close();
  }
}

/** The `grab-url` CLI script this package depends on. */
function grabUrlCli(): string {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve("grab-url/package.json");
  const bin = (require(manifestPath) as { bin: Record<string, string> }).bin["grab-url"];
  return path.join(path.dirname(manifestPath), bin);
}

/**
 * Downloads one archive with the `grab-url` CLI (progress bar and all).
 *
 * @param archive - The archive to fetch.
 * @param outDir - Directory the ZIP is saved into, under its own file name.
 */
export function runGrabUrl(archive: CaselistArchive, outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [grabUrlCli(), archive.url, "-o", path.join(outDir, archive.fileName)],
      { stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`grab-url failed on ${archive.fileName} with exit code ${code}`));
    });
  });
}

/**
 * Runs the downloader.
 *
 * @param argv - Arguments after the script name.
 * @returns The archives chosen (downloaded, unless `--dry-run`).
 */
export async function runDownload(argv: readonly string[] = []): Promise<CaselistArchive[]> {
  const options = parseDownloadArgs(argv);
  const html = options.htmlFile ? await fs.readFile(path.resolve(options.htmlFile), "utf8") : undefined;

  const downloads = await fetchCaselistDownloads(options.slug, {
    html,
    probeWeeks: options.weeks ?? seasonProbeWeeks(options.slug),
  });
  if (!downloads.all && downloads.weekly.length === 0) {
    throw new Error(
      [`No ZIP archives found for ${options.slug}.`, ...downloads.notes.map((note) => `  · ${note}`)].join("\n"),
    );
  }

  const selection = options.selection ?? (await promptSelection(downloads));
  const selected = selectArchives(downloads, selection);
  if (selected.length === 0) throw new Error("No archives matched that selection.");

  console.log(`\n${options.dryRun ? "Would download" : "Downloading"} ${selected.length} ZIP file(s):\n`);
  for (const archive of selected) console.log(`- ${archive.fileName}`);
  if (options.dryRun) return selected;

  const outDir = path.resolve(options.outDir);
  mkdirSync(outDir, { recursive: true });
  for (const archive of selected) {
    console.log(`\n→ Downloading ${archive.fileName}`);
    await runGrabUrl(archive, outDir);
  }
  console.log(`\nDone. Saved to ${outDir}`);
  return selected;
}

if (import.meta.main) {
  runDownload(process.argv.slice(2)).catch((error: Error) => {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  });
}
