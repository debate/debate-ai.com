/**
 * @fileoverview Discovers, tracks and downloads openCaselist bulk archives.
 *
 * The fetching half of the caselist sync; the parsing half is
 * {@link ./downloads-page-parser} and the unpacking half is
 * {@link ./caselist-archive}.
 *
 * `/{slug}/downloads` is a client-rendered React app: a plain GET returns the
 * `<div id="root">` shell and a script tag, and the archive links only exist
 * after the bundle runs. A scraper that reads the raw HTML and finds nothing
 * would be indistinguishable from "no archives cut yet", which is why
 * {@link fetchCaselistDownloads} tries three sources in order and reports
 * which one answered:
 *
 * 1. **api** — the JSON endpoint the page's own client calls. Cheapest and
 *    authoritative when it answers.
 * 2. **html** — the rendered page, for a pre-rendered response or markup
 *    captured by a browser and handed in as {@link FetchOptions.html}.
 * 3. **probe** — the bucket layout is fully determined by the slug and the
 *    date ({@link archiveUrl}), and archives are cut at midnight every Tuesday,
 *    so the candidate URLs for the last N weeks can be generated and
 *    HEAD-checked. Slower and bounded, but it does not depend on openCaselist's
 *    markup or API staying put.
 *
 * @module caselist/caselist-sync
 */
import grab from "grab-url";
import {
  type Caselist,
  archiveUrl,
  caselistsForSeason,
  downloadsPageUrl,
  parseCaselistSlug,
} from "./caselist-config";
import {
  type CaselistArchive,
  type CaselistDownloads,
  archiveFromUrl,
  buildDownloads,
  listArchives,
  parseDownloadsHtml,
  parseDownloadsPayload,
} from "./downloads-page-parser";

/** Where a manifest's archives were discovered. */
export type DownloadsSource = "api" | "html" | "probe" | "none";

/** A manifest plus how it was obtained. */
export interface CaselistDownloadsResult extends CaselistDownloads {
  source: DownloadsSource;
  /** ISO timestamp of the discovery run. */
  fetchedAt: string;
  /** Why a source was skipped or came back empty, in the order tried. */
  notes: string[];
}

/** Options for {@link fetchCaselistDownloads}. */
export interface FetchOptions {
  /**
   * Pre-rendered markup for the downloads page. Supplied when the caller has
   * already rendered the app (a headless browser, a saved capture), which
   * skips the network entirely.
   */
  html?: string;
  /** Request timeout in seconds. */
  timeout?: number;
  /** Weeks of Tuesdays to probe when the API and the page both come up empty. */
  probeWeeks?: number;
  /** Skip the bucket probe. On by default only because it costs one request
   *  per week probed. */
  probe?: boolean;
}

/** Candidate JSON endpoints, in the order they are tried. */
const API_ENDPOINTS = (slug: string): string[] => [
  `https://api.opencaselist.com/v1/caselists/${slug}/downloads`,
  `https://opencaselist.com/api/v1/caselists/${slug}/downloads`,
];

/**
 * Reads a JSON body out of a grab result.
 *
 * grab lifts a decoded JSON body onto the root of its result and also mirrors
 * it under `.data`, so a payload can arrive either way depending on the
 * response's content type.
 *
 * @param result - Whatever grab resolved with.
 * @returns The body to parse, or `null` when the request failed.
 */
function jsonBody(result: any): unknown | null {
  if (!result || result.error) return null;
  if (result.data !== undefined) return result.data;
  return result;
}

/**
 * Discovers the archives openCaselist currently publishes for one caselist.
 *
 * @param slug - Caselist slug, e.g. `hspolicy26`.
 * @param options - Rendered markup, timeout and probe controls.
 * @returns The manifest, the source that produced it, and per-source notes.
 *   Never throws for an unreachable source — a run that finds nothing returns
 *   `source: "none"` with the reasons, because a caller syncing five caselists
 *   should not lose four of them to one outage.
 */
export async function fetchCaselistDownloads(
  slug: string,
  options: FetchOptions = {},
): Promise<CaselistDownloadsResult> {
  const caselist = parseCaselistSlug(slug);
  const resolved = caselist?.slug ?? slug;
  const timeout = options.timeout ?? 30;
  const notes: string[] = [];
  const finish = (
    downloads: CaselistDownloads,
    source: DownloadsSource,
  ): CaselistDownloadsResult => ({
    ...downloads,
    source,
    fetchedAt: new Date().toISOString(),
    notes,
  });
  const hasArchives = (downloads: CaselistDownloads) =>
    listArchives(downloads).length > 0;

  // 0. Markup the caller already has beats any request we could make.
  if (options.html) {
    const parsed = parseDownloadsHtml(options.html, resolved);
    if (hasArchives(parsed)) return finish(parsed, "html");
    notes.push("Supplied markup linked no archives.");
  }

  // 1. The API the page's own client calls.
  for (const endpoint of API_ENDPOINTS(resolved)) {
    try {
      const result = await grab(endpoint, {
        headers: { Accept: "application/json" },
        timeout,
        // Off for the same reason every scraper in this repo turns it off:
        // grab keys cancellation by path, so two concurrent syncs of different
        // caselists would cancel each other on the server.
        cancelOngoingIfNew: false,
        cache: false,
      });
      const body = jsonBody(result);
      if (!body) {
        notes.push(`${endpoint} failed: ${result?.error ?? "no body"}`);
        continue;
      }
      const parsed = parseDownloadsPayload(body, resolved);
      if (hasArchives(parsed)) return finish(parsed, "api");
      notes.push(`${endpoint} returned no archives for ${resolved}.`);
    } catch (error) {
      notes.push(`${endpoint} threw: ${(error as Error).message}`);
    }
  }

  // 2. The rendered page, in case it is served pre-rendered.
  const pageUrl = downloadsPageUrl(resolved);
  try {
    const result = await grab(pageUrl, {
      timeout,
      cancelOngoingIfNew: false,
      cache: false,
    });
    const html = typeof result?.data === "string" ? result.data : "";
    const parsed = parseDownloadsHtml(html, resolved);
    if (hasArchives(parsed)) return finish(parsed, "html");
    notes.push(
      html
        ? `${pageUrl} returned markup with no archive links — it is the client-rendered shell.`
        : `${pageUrl} returned no markup.`,
    );
  } catch (error) {
    notes.push(`${pageUrl} threw: ${(error as Error).message}`);
  }

  // 3. Generate the URLs the bucket layout implies and see which exist.
  if (options.probe !== false) {
    const probed = await probeArchives(resolved, {
      weeks: options.probeWeeks ?? 8,
      timeout,
    });
    if (probed.length > 0) {
      notes.push(`Recovered ${probed.length} archive(s) by probing the bucket.`);
      return finish(buildDownloads(resolved, probed), "probe");
    }
    notes.push("Bucket probe found no archives.");
  }

  return finish(buildDownloads(resolved, []), "none");
}

/**
 * The Tuesdays an archive could have been cut on, newest first.
 *
 * Archives are published at midnight every Tuesday morning, so the newest
 * candidate is today when today is a Tuesday, else the Tuesday before.
 *
 * @param weeks - How many Tuesdays to generate.
 * @param from - The date to count back from. Defaults to now.
 * @returns `YYYY-MM-DD` dates, newest first.
 */
export function recentArchiveDates(weeks: number, from: Date = new Date()): string[] {
  // UTC throughout: the bucket names a date, not a moment, and deriving it
  // from a local clock would shift the whole list by a day west of Greenwich.
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const daysSinceTuesday = (cursor.getUTCDay() - 2 + 7) % 7;
  cursor.setUTCDate(cursor.getUTCDate() - daysSinceTuesday);

  const dates: string[] = [];
  for (let week = 0; week < Math.max(0, weeks); week += 1) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  return dates;
}

/**
 * Checks which generated archive URLs actually exist.
 *
 * @param slug - Caselist slug.
 * @param options - How many weeks back to probe, and the request timeout.
 * @returns The archives that responded, newest first.
 */
export async function probeArchives(
  slug: string,
  options: { weeks?: number; timeout?: number } = {},
): Promise<CaselistArchive[]> {
  const dates = recentArchiveDates(options.weeks ?? 8);
  const candidates = [
    ...dates.map((date) => archiveUrl(slug, "all", date)),
    ...dates.map((date) => archiveUrl(slug, "weekly", date)),
  ];

  const found: CaselistArchive[] = [];
  await Promise.all(
    candidates.map(async (url) => {
      if (await archiveExists(url, options.timeout)) {
        const archive = archiveFromUrl(url);
        if (archive) found.push(archive);
      }
    }),
  );
  return found.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
}

/**
 * HEAD-checks one archive URL.
 *
 * Uses `fetch` rather than grab: this wants a status code and no body, and
 * grab is built to decode a body. Any network error reads as "not there",
 * since a probe is a best-effort fallback and a false negative only costs the
 * caller one archive it will see again next run.
 *
 * @param url - Archive URL to check.
 * @param timeout - Seconds to wait.
 * @returns Whether the URL responded OK.
 */
export async function archiveExists(url: string, timeout = 30): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout * 1000);
  try {
    const response = await fetch(url, { method: "HEAD", signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** A downloaded archive, ready for {@link loadCaselistArchive}. */
export interface DownloadedArchive {
  archive: CaselistArchive;
  bytes: ArrayBuffer;
}

/**
 * Downloads one archive.
 *
 * `fetch` rather than grab, deliberately: a season dump is hundreds of
 * megabytes of ZIP, and grab's value — decoding a body into JSON or a DOM,
 * caching it, de-duplicating in-flight requests — is all wrong for binary of
 * that size.
 *
 * @param archive - The archive to download.
 * @param options - `signal` to cancel, `maxBytes` to refuse an oversized file
 *   before reading it.
 * @returns The archive and its bytes.
 * @throws When the request fails, or the response is larger than `maxBytes`.
 */
export async function downloadArchive(
  archive: CaselistArchive,
  options: { signal?: AbortSignal; maxBytes?: number } = {},
): Promise<DownloadedArchive> {
  const response = await fetch(archive.url, { signal: options.signal });
  if (!response.ok) {
    throw new Error(
      `Downloading ${archive.fileName} failed: ${response.status} ${response.statusText}`,
    );
  }

  if (options.maxBytes !== undefined) {
    const declared = Number(response.headers.get("content-length") ?? Number.NaN);
    if (Number.isFinite(declared) && declared > options.maxBytes) {
      throw new Error(
        `${archive.fileName} is ${declared} bytes, over the ${options.maxBytes}-byte limit.`,
      );
    }
  }

  const bytes = await response.arrayBuffer();
  if (options.maxBytes !== undefined && bytes.byteLength > options.maxBytes) {
    throw new Error(
      `${archive.fileName} is ${bytes.byteLength} bytes, over the ${options.maxBytes}-byte limit.`,
    );
  }
  return { archive, bytes };
}

/** What a previous run already ingested, keyed by archive URL. */
export interface CaselistSyncState {
  /** ISO timestamp of the last run that changed anything. */
  updatedAt?: string;
  /** Archive URLs already ingested. */
  synced: string[];
}

/**
 * The archives in a manifest that a previous run has not ingested.
 *
 * This is what makes the sync incremental, and it is a pure function of the
 * manifest and the state so a caller can preview a run before spending the
 * bandwidth. The season dump is included only when nothing has been synced
 * yet: once a caselist has been seeded, the weekly deltas carry the same
 * files for a fraction of the bytes.
 *
 * @param downloads - A discovered manifest.
 * @param state - What previous runs ingested.
 * @returns The archives to fetch, the season dump first, then newest weeks.
 */
export function selectPendingArchives(
  downloads: CaselistDownloads,
  state: CaselistSyncState = { synced: [] },
): CaselistArchive[] {
  const synced = new Set(state.synced ?? []);
  const seeded = synced.size > 0;
  const pending: CaselistArchive[] = [];

  if (downloads.all && !synced.has(downloads.all.url) && !seeded) {
    pending.push(downloads.all);
  }
  for (const archive of downloads.weekly) {
    if (!synced.has(archive.url)) pending.push(archive);
  }
  return pending;
}

/**
 * Records archives as ingested.
 *
 * @param state - The state to extend.
 * @param archives - Archives whose ingest succeeded.
 * @returns A new state; the input is not mutated.
 */
export function markSynced(
  state: CaselistSyncState,
  archives: readonly CaselistArchive[],
): CaselistSyncState {
  if (archives.length === 0) return state;
  const synced = new Set(state.synced ?? []);
  for (const archive of archives) synced.add(archive.url);
  return { updatedAt: new Date().toISOString(), synced: [...synced].sort() };
}

/**
 * Discovers archives for several caselists at once.
 *
 * @param slugs - Slugs to sync. Defaults to every caselist of the current
 *   season, so `syncCaselists()` covers HS Policy, HS LD, HS PF, NDT/CEDA and
 *   NFA LD without naming them.
 * @param options - Passed through to {@link fetchCaselistDownloads}.
 * @returns One result per slug, in the order given.
 */
export async function syncCaselists(
  slugs: readonly string[] = caselistsForSeason().map((caselist: Caselist) => caselist.slug),
  options: FetchOptions = {},
): Promise<CaselistDownloadsResult[]> {
  const results: CaselistDownloadsResult[] = [];
  // Serial on purpose: five caselists against one origin, and a parallel fan-out
  // of probes would be the one thing this sync does that looks like abuse.
  for (const slug of slugs) {
    results.push(await fetchCaselistDownloads(slug, options));
  }
  return results;
}
