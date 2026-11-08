/**
 * @fileoverview Discovers, tracks and downloads openCaselist bulk archives.
 *
 * The fetching half of the caselist sync; the parsing half is
 * {@link ./downloads-page-parser} and the unpacking half is
 * {@link ./caselist-archive}.
 *
 * Discovery has exactly one source: the archive list behind
 * `https://opencaselist.com/<caselist>/downloads` (e.g.
 * `opencaselist.com/hspolicy26/downloads`), read the way that page's own
 * client reads it — `GET api.opencaselist.com/v1/caselists/<caselist>/downloads`
 * through the signed-in openCaselist API client ({@link createCaselistClient}),
 * with the `caselist_token` session or a Tabroom login. The page itself is a
 * client-rendered shell, and the endpoint answers only signed-in requests, so
 * the earlier anonymous fetch-then-fall-back chain (rendered HTML, an
 * all-years crawl, a bucket probe) found nothing it could trust and has been
 * dropped. Without a session the result says so instead of guessing.
 *
 * @module caselist/caselist-sync
 */
import {
  type Caselist,
  caselistsForSeason,
  downloadsPageUrl,
  parseCaselistSlug,
} from "./caselist-config";
import {
  type CaselistArchive,
  type CaselistDownloads,
  buildDownloads,
  listArchives,
  parseDownloadsPayload,
} from "./downloads-page-parser";
import { CaselistApiError, type CaselistClient, createCaselistClient } from "./caselist-api";

/** Where a manifest's archives were discovered. */
export type DownloadsSource = "api" | "none";

/** A manifest plus how it was obtained. */
export interface CaselistDownloadsResult extends CaselistDownloads {
  source: DownloadsSource;
  /** ISO timestamp of the discovery run. */
  fetchedAt: string;
  /** Why discovery came back empty, when it did. */
  notes: string[];
}

/** Options for {@link fetchCaselistDownloads}: the openCaselist session. */
export interface FetchOptions {
  /** A ready client (tests, or a caller that already holds one). */
  client?: CaselistClient;
  /** A `caselist_token` cookie value. */
  token?: string | null;
  /** Tabroom login, used to mint a token when none is given. */
  username?: string | null;
  password?: string | null;
  /** API root override. */
  origin?: string;
  fetch?: typeof fetch;
}

/** The openCaselist session from the environment (`CASELIST_TOKEN`, or `CASELIST_USERNAME` + `CASELIST_PASSWORD`). */
export function caselistSessionFromEnv(env: Record<string, string | undefined> = process.env): FetchOptions {
  const read = (key: string) => env[key]?.trim() || undefined;
  return { token: read("CASELIST_TOKEN"), username: read("CASELIST_USERNAME"), password: read("CASELIST_PASSWORD") };
}

/**
 * Lists the archives on one caselist's downloads page.
 *
 * @param slug - Caselist slug (`hspolicy26`), or its downloads page URL
 *   (`https://opencaselist.com/hspolicy26/downloads`).
 * @param options - The openCaselist session.
 * @returns The manifest. Never throws for an upstream failure — a run that
 *   finds nothing returns `source: "none"` with the reason, because a caller
 *   syncing five caselists should not lose four of them to one outage.
 */
export async function fetchCaselistDownloads(
  slug: string,
  options: FetchOptions = {},
): Promise<CaselistDownloadsResult> {
  const resolved = parseCaselistSlug(slug)?.slug ?? slug;
  const notes: string[] = [];
  const finish = (downloads: CaselistDownloads, source: DownloadsSource): CaselistDownloadsResult => ({
    ...downloads,
    pageUrl: downloadsPageUrl(resolved),
    source,
    fetchedAt: new Date().toISOString(),
    notes,
  });

  const hasSession = Boolean(options.client || options.token || (options.username && options.password));
  if (!hasSession) {
    notes.push(
      "openCaselist needs a session: set CASELIST_TOKEN (a caselist_token cookie) or CASELIST_USERNAME and CASELIST_PASSWORD (a Tabroom login).",
    );
    return finish(buildDownloads(resolved, []), "none");
  }

  const client =
    options.client ??
    createCaselistClient({
      token: options.token,
      username: options.username,
      password: options.password,
      origin: options.origin,
      fetch: options.fetch,
    });
  try {
    const parsed = parseDownloadsPayload(await client.downloads(resolved), resolved);
    if (listArchives(parsed).length > 0) return finish(parsed, "api");
    notes.push(`${downloadsPageUrl(resolved)} lists no archives yet.`);
  } catch (error) {
    notes.push(
      error instanceof CaselistApiError && error.status === 401
        ? "The openCaselist session was refused (expired token or wrong login)."
        : `openCaselist downloads for ${resolved} failed: ${(error as Error).message}`,
    );
  }
  return finish(buildDownloads(resolved, []), "none");
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
  // Serial on purpose: five caselists against one rate-limited origin.
  for (const slug of slugs) {
    results.push(await fetchCaselistDownloads(slug, options));
  }
  return results;
}
