/**
 * @fileoverview Style-aware discovery of openCaselist ZIP archives, and the
 * "latest per family" selection over what was found.
 *
 * openCaselist exposes its archives two ways, and this module reads both:
 *
 * - **`5s` (download-page style)** — `/{slug}/downloads`, where every ZIP is
 *   linked from one bulk page. One request, read the hrefs, done.
 * - **`all` (all-years / caselist style)** — `/{slug}`, where the archives
 *   hang off linked routes (other seasons, the downloads page). The crawler
 *   follows caselist and `/downloads` routes on the openCaselist origin,
 *   breadth first and bounded by {@link CrawlOptions.maxPages}, collecting
 *   every ZIP it passes.
 *
 * Neither mode keys on markup: both read `<a href>` values and identify an
 * archive by its file name, the same rule {@link ./downloads-page-parser}
 * uses, so a redeploy that renames every CSS class changes nothing here.
 *
 * Selection is separate from discovery. {@link selectLatestByFamily} groups
 * archives by their date-stripped file name (`hspf26-all-2026-09-15.zip` and
 * `hspf26-all-2026-09-22.zip` are one family) and keeps the newest of each,
 * which yields the current season dump and the current weekly rather than
 * every historical snapshot. {@link planCaselistSync} is the incremental
 * version the admin sync uses: what to fetch given what is already imported.
 *
 * @module caselist/caselist-discovery
 */
import grab from "grab-url";
import {
  CASELIST_ORIGIN,
  type CaselistArchiveKind,
  downloadsPageUrl,
  parseCaselistSlug,
} from "./caselist-config";
import {
  type CaselistArchive,
  type CaselistDownloads,
  archiveFromUrl,
  parseArchiveFileName,
} from "./downloads-page-parser";

/** The two page styles openCaselist serves archives from. */
export type CaselistDownloadStyle = "5s" | "all";

/** What each style means, for a CLI menu or an admin control. */
export const CASELIST_DOWNLOAD_STYLES: Record<
  CaselistDownloadStyle,
  { label: string; mode: "download-page" | "recursive" }
> = {
  "5s": { label: "Bulk downloads page (weekly archive style)", mode: "download-page" },
  all: { label: "Discover all linked years and archive pages", mode: "recursive" },
};

/** Broad kind of a discovered ZIP, read off its file name. */
export type DiscoveredArchiveKind = CaselistArchiveKind | "open-source" | "private" | "other";

/** One ZIP link found on an openCaselist page. */
export interface DiscoveredArchive {
  /** Absolute URL of the `.zip`. */
  url: string;
  /** Decoded file name at the end of the URL. */
  fileName: string;
  /** `YYYY-MM-DD` from the file name, or `null` when undated. */
  date: string | null;
  kind: DiscoveredArchiveKind;
  /** File name with its date and extension stripped, lowercased. */
  family: string;
  /** Page the link was found on. */
  sourcePage: string;
}

/** Fetches a page's markup; injectable so the crawler is testable offline. */
export type HtmlFetcher = (url: string) => Promise<string>;

/** Options for {@link discoverCaselistArchives}. */
export interface CrawlOptions {
  /** Pages the recursive crawl may visit. */
  maxPages?: number;
  /** Markup fetcher. Defaults to a grab-backed GET. */
  fetchHtml?: HtmlFetcher;
  /** Request timeout in seconds for the default fetcher. */
  timeout?: number;
}

/** Result of one discovery run. */
export interface DiscoveryResult {
  /** Unique archives found, newest first. */
  archives: DiscoveredArchive[];
  /** Pages actually read. */
  pages: string[];
  /** Pages that could not be read, and why. */
  notes: string[];
}

const ZIP_PATH = /\.zip$/i;
const DATE_IN_NAME = /(\d{4}-\d{2}-\d{2})/;
const DATED_SUFFIX = /-\d{4}-\d{2}-\d{2}$/;
/** `/hspf26`, `/ndtceda25/downloads` — a caselist root or its downloads page. */
const CASELIST_ROUTE = /^\/[a-z]+\d{2}(?:\/downloads)?\/?$/i;
const ANCHOR_HREF = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;

/**
 * Resolves an href against the page it was found on.
 *
 * @param href - Raw attribute value.
 * @param baseUrl - The page's URL.
 * @returns The absolute URL, or `null` for an unparseable href.
 */
function resolveHref(href: string, baseUrl: string): string | null {
  try {
    return new URL(href.replace(/&amp;/g, "&"), baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * The decoded file name at the end of a URL.
 *
 * @param url - Absolute URL.
 * @returns Its last path segment.
 */
function fileNameOf(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  } catch {
    return url.split(/[?#]/)[0].split("/").pop() ?? "";
  }
}

/**
 * Whether a URL names a ZIP, ignoring its query string.
 *
 * @param url - Absolute URL.
 * @returns `true` for a `.zip` path.
 */
export function isZipUrl(url: string): boolean {
  try {
    return ZIP_PATH.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/**
 * Classifies an archive by its file name.
 *
 * @param fileName - File name or URL.
 * @returns `all`, `weekly`, `open-source`, `private`, or `other`.
 */
export function archiveKindOf(fileName: string): DiscoveredArchiveKind {
  const parsed = parseArchiveFileName(fileName);
  if (parsed) return parsed.kind;
  const name = fileName.toLowerCase();
  if (name.includes("-all-")) return "all";
  if (name.includes("-weekly-")) return "weekly";
  if (name.includes("-open-source-") || name.includes("-opensource-")) return "open-source";
  if (name.includes("-private-")) return "private";
  return "other";
}

/**
 * The family an archive belongs to: its file name without date or extension.
 *
 * @param fileName - File name or URL.
 * @returns e.g. `hspf26-all` for `hspf26-all-2026-09-22.zip`.
 */
export function archiveFamilyOf(fileName: string): string {
  const base = String(fileName).split(/[?#]/)[0].split("/").pop() ?? "";
  return base.replace(/\.zip$/i, "").replace(DATED_SUFFIX, "").toLowerCase();
}

/**
 * Describes one ZIP link.
 *
 * @param url - Absolute URL of the `.zip`.
 * @param sourcePage - Page the link was found on.
 * @returns The discovered archive.
 */
export function describeArchiveLink(url: string, sourcePage: string): DiscoveredArchive {
  const fileName = fileNameOf(url);
  return {
    url,
    fileName,
    date: DATE_IN_NAME.exec(fileName)?.[1] ?? null,
    kind: archiveKindOf(fileName),
    family: archiveFamilyOf(fileName),
    sourcePage,
  };
}

/**
 * Every resolvable href on a page.
 *
 * @param html - Page markup.
 * @param pageUrl - URL the markup came from, for resolving relative hrefs.
 * @returns Unique absolute URLs in document order.
 */
export function extractLinks(html: string, pageUrl: string): string[] {
  const links = new Set<string>();
  for (const match of String(html ?? "").matchAll(ANCHOR_HREF)) {
    const resolved = resolveHref(match[1], pageUrl);
    if (resolved) links.add(resolved);
  }
  return [...links];
}

/**
 * The ZIP archives linked from a page.
 *
 * @param html - Page markup.
 * @param pageUrl - URL the markup came from.
 * @returns One entry per unique ZIP link.
 */
export function extractArchiveLinks(html: string, pageUrl: string): DiscoveredArchive[] {
  return extractLinks(html, pageUrl)
    .filter(isZipUrl)
    .map((url) => describeArchiveLink(url, pageUrl));
}

/**
 * Whether the crawler should follow a link.
 *
 * Only caselist roots and their downloads pages on the openCaselist origin:
 * school and team pages number in the thousands and carry no bulk archives.
 *
 * @param url - Absolute URL.
 * @returns `true` when the URL is a caselist or downloads route.
 */
export function isCrawlableCaselistRoute(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== new URL(CASELIST_ORIGIN).origin) return false;
    return CASELIST_ROUTE.test(parsed.pathname) || parsed.pathname.endsWith("/downloads");
  } catch {
    return false;
  }
}

/** Newest first, undated last, ties by file name. */
function newestFirst(a: DiscoveredArchive, b: DiscoveredArchive): number {
  const left = a.date ?? "0000-00-00";
  const right = b.date ?? "0000-00-00";
  if (left !== right) return left < right ? 1 : -1;
  return a.fileName.localeCompare(b.fileName);
}

/**
 * Sorts archives newest first without mutating the input.
 *
 * @param archives - Archives in any order.
 * @returns A sorted copy.
 */
export function sortArchivesNewestFirst(archives: readonly DiscoveredArchive[]): DiscoveredArchive[] {
  return [...archives].sort(newestFirst);
}

/**
 * Keeps the newest archive of each family.
 *
 * @param archives - Archives in any order, possibly with duplicates.
 * @returns One archive per family, sorted by file name.
 */
export function selectLatestByFamily(
  archives: readonly DiscoveredArchive[],
): DiscoveredArchive[] {
  const latest = new Map<string, DiscoveredArchive>();
  for (const archive of archives) {
    const existing = latest.get(archive.family);
    if (!existing || (archive.date ?? "0000-00-00") > (existing.date ?? "0000-00-00")) {
      latest.set(archive.family, archive);
    }
  }
  return [...latest.values()].sort((a, b) => a.fileName.localeCompare(b.fileName));
}

/**
 * Default fetcher: a grab GET that yields the body as text.
 *
 * @param timeout - Seconds to wait.
 * @returns An {@link HtmlFetcher}.
 */
function grabHtmlFetcher(timeout: number): HtmlFetcher {
  return async (url) => {
    const result: any = await grab(url, {
      timeout,
      cancelOngoingIfNew: false,
      cache: false,
    });
    if (!result || result.error) throw new Error(String(result?.error ?? "no response"));
    if (typeof result.data === "string") return result.data;
    if (typeof result === "string") return result;
    throw new Error("response was not markup");
  };
}

/**
 * The page each style starts from for a caselist.
 *
 * @param slug - Caselist slug, path or URL.
 * @param style - `5s` for the downloads page, `all` for the caselist root.
 * @returns The start URL.
 */
export function styleStartUrl(slug: string, style: CaselistDownloadStyle): string {
  const resolved = parseCaselistSlug(slug)?.slug ?? slug;
  return style === "5s" ? downloadsPageUrl(resolved) : `${CASELIST_ORIGIN}/${resolved}`;
}

/**
 * Discovers the ZIP archives for a caselist in the given style.
 *
 * The `5s` style reads one page; if that page is unreachable or links
 * nothing — NDT/CEDA has served no downloads page in some seasons — it falls
 * back to the `all` crawl instead of reporting an empty caselist.
 *
 * @param slug - Caselist slug, e.g. `hspf26`.
 * @param style - Page style to start from.
 * @param options - Page budget and fetcher.
 * @returns The archives found, the pages read, and why any page was skipped.
 *   Never throws for an unreachable page.
 */
export async function discoverCaselistArchives(
  slug: string,
  style: CaselistDownloadStyle = "5s",
  options: CrawlOptions = {},
): Promise<DiscoveryResult> {
  const fetchHtml = options.fetchHtml ?? grabHtmlFetcher(options.timeout ?? 30);
  const maxPages = Math.max(1, options.maxPages ?? 30);
  const notes: string[] = [];
  const pages: string[] = [];
  const found = new Map<string, DiscoveredArchive>();

  const readPage = async (url: string): Promise<string | null> => {
    try {
      const html = await fetchHtml(url);
      pages.push(url);
      return html;
    } catch (error) {
      notes.push(`${url}: ${(error as Error).message}`);
      return null;
    }
  };

  if (style === "5s") {
    const pageUrl = styleStartUrl(slug, "5s");
    const html = await readPage(pageUrl);
    if (html !== null) {
      for (const archive of extractArchiveLinks(html, pageUrl)) found.set(archive.url, archive);
    }
    if (found.size > 0) {
      return { archives: sortArchivesNewestFirst([...found.values()]), pages, notes };
    }
    notes.push(`${pageUrl} linked no archives; falling back to all-years discovery.`);
  }

  const pending = [styleStartUrl(slug, "all")];
  const seen = new Set<string>();
  while (pending.length > 0 && seen.size < maxPages) {
    const pageUrl = pending.shift() as string;
    if (seen.has(pageUrl)) continue;
    seen.add(pageUrl);
    // The 5s pass already read (and failed on) the downloads page once.
    if (style === "5s" && pageUrl === styleStartUrl(slug, "5s")) continue;

    const html = await readPage(pageUrl);
    if (html === null) continue;
    for (const link of extractLinks(html, pageUrl)) {
      if (isZipUrl(link)) {
        if (!found.has(link)) found.set(link, describeArchiveLink(link, pageUrl));
      } else if (isCrawlableCaselistRoute(link)) {
        const normalized = link.replace(/[?#].*$/, "").replace(/\/$/, "");
        if (!seen.has(normalized)) pending.push(normalized);
      }
    }
  }

  return { archives: sortArchivesNewestFirst([...found.values()]), pages, notes };
}

/**
 * The typed archives a discovery run found for one caselist.
 *
 * Discovery keeps every ZIP it sees; the sync pipeline only knows how to
 * ingest the `{slug}-{all|weekly}-{date}.zip` bulk archives, and only the
 * ones for the caselist asked for.
 *
 * @param archives - Discovered archives.
 * @param slug - Caselist slug to keep.
 * @returns The matching {@link CaselistArchive}s.
 */
export function toCaselistArchives(
  archives: readonly DiscoveredArchive[],
  slug: string,
): CaselistArchive[] {
  const out: CaselistArchive[] = [];
  for (const archive of archives) {
    const typed = archiveFromUrl(archive.url);
    if (typed && typed.slug === slug) out.push(typed);
  }
  return out;
}

/**
 * The archives an incremental sync should import, given what already is.
 *
 * - **Not yet seeded:** the newest season dump, plus any weekly cut after it
 *   (earlier weeks are already inside the dump). With no dump published yet,
 *   every weekly.
 * - **Seeded:** only weeklies not yet imported and dated after the newest
 *   dump that was imported — a newer dump is never re-downloaded, since the
 *   weeklies carry the same files for a fraction of the bytes.
 *
 * Imports are matched by file name, which is what the card library records
 * as each row's source file.
 *
 * @param downloads - A discovered manifest for one caselist.
 * @param importedFileNames - Source files the card library already holds.
 * @returns Archives to import, dump first, then weeklies oldest first so a
 *   run interrupted halfway resumes where it stopped.
 */
export function planCaselistSync(
  downloads: CaselistDownloads,
  importedFileNames: Iterable<string>,
): CaselistArchive[] {
  const imported = new Set<string>();
  let importedDumpDate: string | null = null;
  for (const name of importedFileNames) {
    const parts = parseArchiveFileName(name);
    if (!parts || parts.slug !== downloads.slug) continue;
    imported.add(`${downloads.slug}-${parts.kind}-${parts.date}.zip`);
    if (parts.kind === "all" && (!importedDumpDate || parts.date > importedDumpDate)) {
      importedDumpDate = parts.date;
    }
  }
  const weeklyOldestFirst = [...downloads.weekly].sort((a, b) =>
    a.date === b.date ? 0 : a.date < b.date ? -1 : 1,
  );
  const notImported = (archive: CaselistArchive) => !imported.has(archive.fileName);

  if (imported.size === 0) {
    const dump = downloads.all;
    const weeklies = weeklyOldestFirst.filter((archive) => !dump || archive.date > dump.date);
    return [...(dump ? [dump] : []), ...weeklies];
  }

  return weeklyOldestFirst.filter(
    (archive) => notImported(archive) && (!importedDumpDate || archive.date > importedDumpDate),
  );
}
