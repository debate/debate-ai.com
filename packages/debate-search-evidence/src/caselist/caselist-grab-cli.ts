/**
 * @fileoverview Interactive openCaselist archive grabber: pick a caselist and
 * a page style, choose which ZIPs, and download them with `grab-url`.
 *
 * ```bash
 * bun run grab-caselist                                   # menus
 * bun run grab-caselist -- --caselist=hspf26 --style=5s --select=latest
 * bun run grab-caselist -- --caselist=ndtceda26 --style=all --list
 * ```
 *
 * Styles (see {@link CASELIST_DOWNLOAD_STYLES}):
 * - `5s`  — the `/{slug}/downloads` bulk page; falls back to `all` when the
 *   caselist has no downloads page.
 * - `all` — crawl the caselist root and its linked seasons/downloads routes.
 *
 * Selections: `latest` (newest of each archive family — the usual choice),
 * `newest` (one ZIP), `all` (every ZIP found), or `pick` (numbered list).
 * Files land in `caselist-downloads-{slug}/` under the working directory, or
 * `--out`.
 *
 * @module caselist/caselist-grab-cli
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createInterface } from "node:readline/promises";
import { caselistsForSeason, parseCaselistSlug } from "./caselist-config";
import {
  CASELIST_DOWNLOAD_STYLES,
  type CaselistDownloadStyle,
  type DiscoveredArchive,
  discoverCaselistArchives,
  selectLatestByFamily,
  sortArchivesNewestFirst,
} from "./caselist-discovery";

/** Which archives to download out of what was found. */
export type GrabSelection = "latest" | "newest" | "all" | "pick";

/** Parsed command line; anything unset is asked for interactively. */
export interface GrabOptions {
  slug?: string;
  style?: CaselistDownloadStyle;
  select?: GrabSelection;
  /** 1-based indexes into the newest-first list, for `pick`. */
  picks?: number[];
  out?: string;
  /** Print what was found and exit without downloading. */
  list: boolean;
  maxPages?: number;
}

/**
 * Parses the command line.
 *
 * @param argv - Arguments after the script name.
 * @returns The options given; missing ones stay undefined.
 */
export function parseGrabArgs(argv: readonly string[]): GrabOptions {
  const value = (flag: string) =>
    argv.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1);
  const style = value("--style");
  const select = value("--select");
  const picks = value("--pick");
  const maxPages = value("--max-pages");
  return {
    slug: value("--caselist"),
    style: style === "5s" || style === "all" ? style : undefined,
    select: (["latest", "newest", "all", "pick"] as const).find((choice) => choice === select),
    picks: picks
      ?.split(",")
      .map((item) => Number.parseInt(item.trim(), 10))
      .filter(Number.isInteger),
    out: value("--out"),
    list: argv.includes("--list"),
    maxPages: maxPages ? Number.parseInt(maxPages, 10) : undefined,
  };
}

/**
 * Applies a selection to the archives found.
 *
 * @param archives - Unique archives found.
 * @param select - Which to keep.
 * @param picks - 1-based indexes into the newest-first list, for `pick`.
 * @returns The archives to download.
 */
export function applySelection(
  archives: readonly DiscoveredArchive[],
  select: GrabSelection,
  picks: readonly number[] = [],
): DiscoveredArchive[] {
  const newest = sortArchivesNewestFirst(archives);
  if (select === "latest") return selectLatestByFamily(archives);
  if (select === "newest") return newest.slice(0, 1);
  if (select === "all") return newest;
  return [...new Set(picks)].map((pick) => newest[pick - 1]).filter(Boolean);
}

/**
 * Formats the numbered archive list shown for `pick` and `--list`.
 *
 * @param archives - Archives in display order.
 * @returns One line per archive.
 */
export function formatArchiveList(archives: readonly DiscoveredArchive[]): string[] {
  return archives.map(
    (archive, index) =>
      `${String(index + 1).padStart(2, " ")}. [${archive.kind}] ${archive.date ?? "undated"} — ${archive.fileName}`,
  );
}

/**
 * Downloads one archive with the `grab-url` CLI, falling back to a streamed
 * `fetch` when the CLI cannot be started.
 *
 * @param archive - Archive to download.
 * @param outputDir - Directory to save into.
 */
async function downloadToDir(archive: DiscoveredArchive, outputDir: string): Promise<void> {
  const viaGrab = await new Promise<boolean>((resolve, reject) => {
    const child = spawn("npx", ["--no-install", "grab-url", archive.url], {
      cwd: outputDir,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => {
      if (code === 0) resolve(true);
      else if (code === 127) resolve(false);
      else reject(new Error(`grab-url exited with code ${code}`));
    });
  });
  if (viaGrab) return;

  const response = await fetch(archive.url);
  if (!response.ok || !response.body) {
    throw new Error(`${archive.fileName}: ${response.status} ${response.statusText}`);
  }
  await pipeline(
    Readable.fromWeb(response.body as any),
    createWriteStream(path.join(outputDir, archive.fileName)),
  );
}

/**
 * Runs the grabber.
 *
 * @param argv - Arguments after the script name.
 * @returns The archives selected (downloaded unless `--list`).
 */
export async function run(argv: readonly string[] = []): Promise<DiscoveredArchive[]> {
  const options = parseGrabArgs(argv);
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const choose = async <T>(label: string, choices: { label: string; value: T }[]): Promise<T> => {
    console.log(`\n${label}`);
    choices.forEach((choice, index) => console.log(`${index + 1}. ${choice.label}`));
    const answer = Number.parseInt((await rl.question("\nSelection: ")).trim(), 10);
    const picked = choices[answer - 1];
    if (!picked) throw new Error("Invalid selection.");
    return picked.value;
  };

  try {
    const slug =
      parseCaselistSlug(options.slug ?? "")?.slug ??
      (await choose(
        "Caselist",
        caselistsForSeason().map((caselist) => ({
          label: `${caselist.label} — ${caselist.slug}`,
          value: caselist.slug,
        })),
      ));

    const style =
      options.style ??
      (await choose(
        "Download style",
        (Object.keys(CASELIST_DOWNLOAD_STYLES) as CaselistDownloadStyle[]).map((id) => ({
          label: `${id} — ${CASELIST_DOWNLOAD_STYLES[id].label}`,
          value: id,
        })),
      ));

    console.log(`\nScanning ${slug} (${style})…`);
    const discovered = await discoverCaselistArchives(slug, style, { maxPages: options.maxPages });
    for (const note of discovered.notes) console.log(`   · ${note}`);
    if (discovered.archives.length === 0) throw new Error("No ZIP archives were found.");

    const newest = discovered.archives;
    const latest = selectLatestByFamily(newest);
    console.log(`Found ${newest.length} ZIP archive(s) across ${discovered.pages.length} page(s).`);

    if (options.list) {
      for (const line of formatArchiveList(newest)) console.log(line);
      return newest;
    }

    const select =
      options.select ??
      (await choose<GrabSelection>("Which archives", [
        { label: `Latest archive of each family (${latest.length} ZIPs)`, value: "latest" },
        { label: "One newest ZIP overall", value: "newest" },
        { label: `Every discovered ZIP (${newest.length} ZIPs)`, value: "all" },
        { label: "Choose individual ZIPs", value: "pick" },
      ]));

    let picks = options.picks ?? [];
    if (select === "pick" && picks.length === 0) {
      for (const line of formatArchiveList(newest)) console.log(line);
      const answer = await rl.question("\nEnter comma-separated numbers, such as 1,3,7: ");
      picks = answer.split(",").map((item) => Number.parseInt(item.trim(), 10));
    }

    const selected = applySelection(newest, select, picks);
    if (selected.length === 0) throw new Error("No valid archives were selected.");

    const outputDir = path.resolve(options.out ?? `caselist-downloads-${slug}`);
    await mkdir(outputDir, { recursive: true });
    console.log(`\nDownloading ${selected.length} ZIP(s) into ${outputDir}`);
    for (const archive of selected) {
      console.log(`- ${archive.fileName}`);
      await downloadToDir(archive, outputDir);
    }
    console.log("\nComplete.");
    return selected;
  } finally {
    rl.close();
  }
}

if (import.meta.main) {
  run(process.argv.slice(2)).catch((error: Error) => {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  });
}
