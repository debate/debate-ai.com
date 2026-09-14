/**
 * @fileoverview Pure parsing of an openCaselist bulk-downloads listing into a
 * manifest of archives.
 *
 * Kept free of `fetch`, `grab` and `node:fs` so the identical normalization
 * runs over all three shapes a listing reaches us in — the rendered
 * `/{slug}/downloads` DOM, a JSON payload from the site's own API, and a bare
 * list of bucket URLs — and so a listing captured as a fixture parses exactly
 * as the live page does.
 *
 * The page itself is a client-rendered React app whose markup is a handful of
 * `<h2>` sections over `<p><a href=…>` links, with no ids, no data attributes
 * and CSS-module class names that change on every deploy. Nothing here keys on
 * a class name for that reason: the archives are identified by the file names
 * at the end of their hrefs, which are structural
 * (`{slug}-{all|weekly}-{YYYY-MM-DD}.zip`) and have to stay stable for the
 * bucket to work at all.
 *
 * @module caselist/downloads-page-parser
 */
import {
  type Caselist,
  type CaselistArchiveKind,
  archiveUrl,
  downloadsPageUrl,
  parseCaselistSlug,
} from "./caselist-config";

/** One downloadable bulk archive. */
export interface CaselistArchive {
  /** Absolute URL of the `.zip`. */
  url: string;
  /** File name at the end of the URL, e.g. `hspolicy26-weekly-2026-09-08.zip`. */
  fileName: string;
  /** Caselist slug the archive belongs to. */
  slug: string;
  /** `all` for the season dump, `weekly` for one Tuesday's delta. */
  kind: CaselistArchiveKind;
  /** Archive date as `YYYY-MM-DD`, from the file name. */
  date: string;
}

/** Everything the downloads page says about one caselist. */
export interface CaselistDownloads {
  slug: string;
  /** Label from the page's `<h1>` when present, else the catalog label. */
  label: string;
  /** The page this manifest was read from. */
  pageUrl: string;
  /** The whole-season dump, or `null` when the page lists none. */
  all: CaselistArchive | null;
  /** Weekly deltas, newest first. */
  weekly: CaselistArchive[];
}

/** Shape of a parsed archive file name. */
export interface ArchiveFileNameParts {
  slug: string;
  kind: CaselistArchiveKind;
  date: string;
}

const ARCHIVE_FILE_NAME = /^([a-z0-9]+)-(all|weekly)-(\d{4}-\d{2}-\d{2})\.zip$/i;

/**
 * Reads a bulk archive's file name.
 *
 * @param fileName - File name or full URL ending in the file name.
 * @returns Its slug, kind and date, or `null` when the name is not an archive.
 */
export function parseArchiveFileName(fileName: string): ArchiveFileNameParts | null {
  const base = String(fileName).split(/[?#]/)[0].split("/").pop() ?? "";
  const match = ARCHIVE_FILE_NAME.exec(base);
  if (!match) return null;
  return {
    slug: match[1].toLowerCase(),
    kind: match[2].toLowerCase() as CaselistArchiveKind,
    date: match[3],
  };
}

/**
 * Turns an archive URL into a {@link CaselistArchive}.
 *
 * @param url - Absolute or bucket-relative URL of a `.zip`.
 * @returns The archive, or `null` when the URL does not name one.
 */
export function archiveFromUrl(url: string): CaselistArchive | null {
  const trimmed = String(url).trim();
  const parts = parseArchiveFileName(trimmed);
  if (!parts) return null;
  const fileName = trimmed.split(/[?#]/)[0].split("/").pop() as string;
  return {
    url: /^https?:\/\//i.test(trimmed)
      ? trimmed
      : archiveUrl(parts.slug, parts.kind, parts.date),
    fileName,
    slug: parts.slug,
    kind: parts.kind,
    date: parts.date,
  };
}

/** Newest first, with ties broken by file name so the order is total. */
function byDateDescending(a: CaselistArchive, b: CaselistArchive): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.fileName.localeCompare(b.fileName);
}

/**
 * Collects archives into a manifest, de-duplicated by URL.
 *
 * A page can link the same archive twice — the season dump also appears in the
 * weekly list on the week it was cut — and a caller can concatenate an API
 * response with a probe result. Both collapse here rather than in each caller.
 *
 * @param slug - Caselist slug the manifest is for.
 * @param archives - Archives in any order, possibly with duplicates.
 * @param options - `label` and `pageUrl` overrides for the manifest header.
 * @returns The manifest, weekly archives newest first.
 */
export function buildDownloads(
  slug: string,
  archives: readonly CaselistArchive[],
  options: { label?: string; pageUrl?: string } = {},
): CaselistDownloads {
  const seen = new Map<string, CaselistArchive>();
  for (const archive of archives) {
    // Only the caselist asked for: a page footer or an API envelope can carry
    // links to a sibling caselist, and silently syncing HS LD into a Policy
    // run is worse than dropping the stray link.
    if (archive.slug !== slug) continue;
    if (!seen.has(archive.url)) seen.set(archive.url, archive);
  }
  const collected = [...seen.values()];
  const all = collected.filter((archive) => archive.kind === "all").sort(byDateDescending);
  const weekly = collected.filter((archive) => archive.kind === "weekly").sort(byDateDescending);
  const catalog: Caselist | null = parseCaselistSlug(slug);

  return {
    slug,
    label: options.label ?? catalog?.label ?? slug,
    pageUrl: options.pageUrl ?? downloadsPageUrl(slug),
    all: all[0] ?? null,
    weekly,
  };
}

const ANCHOR_HREF = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
const H1_TEXT = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi;
const PAGE_TITLE = /^Bulk downloads for\s+(.+)$/i;

/**
 * Strips tags and collapses whitespace in a snippet of markup.
 *
 * @param html - Inner HTML of a heading.
 * @returns Its text content.
 */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses a rendered bulk-downloads page.
 *
 * Regex rather than a DOM parse on purpose: this runs in the Worker as well as
 * in Bun, the input is a whole React-rendered document, and the only thing
 * being read out of it is the href list — pulling `linkedom` into that path
 * costs more than it explains.
 *
 * @param html - The rendered page markup.
 * @param slug - Caselist the page is for. Inferred from the archive links when
 *   omitted, so a saved page parses without being told what it is.
 * @returns The manifest. A page with no archive links yields empty lists rather
 *   than throwing — "no weekly cut yet" is a normal state early in a season.
 */
export function parseDownloadsHtml(html: string, slug?: string): CaselistDownloads {
  const source = String(html ?? "");
  const archives: CaselistArchive[] = [];
  for (const match of source.matchAll(ANCHOR_HREF)) {
    const archive = archiveFromUrl(match[1]);
    if (archive) archives.push(archive);
  }

  const resolved =
    parseCaselistSlug(slug ?? "")?.slug ?? slug ?? archives[0]?.slug ?? "";
  // The site header is itself an `<h1>` ("openCaselist") and comes first in
  // document order, so the page's own title is found by what it says rather
  // than by being the first heading.
  let label: string | undefined;
  for (const heading of source.matchAll(H1_TEXT)) {
    const title = PAGE_TITLE.exec(textOf(heading[1]));
    if (title) {
      label = title[1].trim() || undefined;
      break;
    }
  }

  return buildDownloads(resolved, archives, { label });
}

/**
 * Parses a JSON payload of downloads into the same manifest.
 *
 * openCaselist's own client fetches the listing from its API before rendering
 * it, and the payload has been published as bare URL strings, as
 * `{ url }`/`{ file }` objects and as those wrapped in `downloads`, `files` or
 * `data`. All of them are the same list of bucket URLs, so all of them are
 * read the same way instead of pinning one envelope that a deploy can change.
 *
 * @param payload - Decoded JSON body.
 * @param slug - Caselist the payload is for.
 * @returns The manifest.
 */
export function parseDownloadsPayload(payload: unknown, slug?: string): CaselistDownloads {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as any)?.downloads)
      ? (payload as any).downloads
      : Array.isArray((payload as any)?.files)
        ? (payload as any).files
        : Array.isArray((payload as any)?.data)
          ? (payload as any).data
          : [];

  const archives: CaselistArchive[] = [];
  for (const row of rows) {
    const candidate =
      typeof row === "string"
        ? row
        : (row?.url ?? row?.href ?? row?.file ?? row?.filename ?? row?.name ?? "");
    const archive = archiveFromUrl(String(candidate));
    if (archive) archives.push(archive);
  }

  const resolved =
    parseCaselistSlug(slug ?? "")?.slug ?? slug ?? archives[0]?.slug ?? "";
  return buildDownloads(resolved, archives);
}

/**
 * Every archive in a manifest, the season dump first.
 *
 * @param downloads - A parsed manifest.
 * @returns The dump followed by the weekly deltas, newest first.
 */
export function listArchives(downloads: CaselistDownloads): CaselistArchive[] {
  return [...(downloads.all ? [downloads.all] : []), ...downloads.weekly];
}
