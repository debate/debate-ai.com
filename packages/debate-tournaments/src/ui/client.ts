/**
 * Typed fetches against the tournaments API (`createTournamentsHandler`),
 * for the React UI. Shapes are upstream Tabroom's public responses, narrowed
 * to the fields the UI reads, plus this app's own `/host` endpoints.
 *
 * Two sources can sit behind one client: `apiBase`, this package's own API
 * (tournaments hosted on this site, the demo, and every `/host` write), and an
 * optional `liveApiBase`, a read-only proxy to live Tabroom. The upcoming list
 * merges both, and each tournament's pages read from whichever source holds
 * it — the hosted copy wins when both answer.
 */

import type { TournamentFormatId } from "../host/formats";

export interface UpcomingTournament {
  id: string;
  tournId: number;
  webname: string | null;
  name: string;
  location: string | null;
  state: string | null;
  country: string | null;
  start: string;
  end: string;
  dates?: string;
  fullDates?: string;
  circuits?: string | null;
  events?: string | null;
  eventTypes?: string | null;
  modes?: string | null;
  schoolCount?: number;
  /** Which source the row came from: hosted on this site, or live Tabroom. */
  source?: TournamentSource;
}

/** `hosted`: this site's own API (`apiBase`). `tabroom`: live Tabroom (`liveApiBase`). */
export type TournamentSource = "hosted" | "tabroom";

export interface InviteEvent {
  id: number;
  abbr: string;
  name: string;
  type: string;
  fee: number | null;
  Category?: { id: number; abbr: string; name: string };
  settings?: { description?: string | null; currency?: string | null; cap?: string | null };
  metadata?: { entryCount?: number };
}

export interface TournamentInvite {
  id: number;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  tz: string | null;
  webname: string | null;
  start: string | null;
  end: string | null;
  reg_start: string | null;
  reg_end: string | null;
  Files: Array<{ id: number; label: string | null; filename: string | null; tag: string | null }>;
  Webpages: Array<{ id: number; title: string | null; content: string | null; slug?: string | null }>;
  Events: InviteEvent[];
  Contacts: Array<{ id: number; first: string | null; last: string | null; email: string | null }>;
}

/** One entry in an event's published field (`/rest/tourns/:id/events/:abbr/field`). */
export interface FieldEntry {
  id: number;
  /** Debater names as the tournament writes them, e.g. `"Hu & Liu"`. */
  name: string;
  code: string | null;
  School?: { id: number; name: string; code: string | null } | null;
}

/** An event's published field: every entry registered in it, with its school. */
export interface EventField {
  id: number;
  name: string;
  abbr: string;
  type: string;
  Entries: FieldEntry[];
}

export interface PublishedRound {
  id: number;
  type: string;
  name: number;
  label: string | null;
  Event: { id: number; name: string; abbr: string; type: string };
}

export interface RoundSchematic {
  id: number;
  name: number;
  label: string | null;
  type: string;
  tz: string | null;
  startTime: string | null;
  Event: { id: number; name: string; abbr: string; type: string };
  Sections: Record<
    string,
    {
      id: number;
      letter: string | null;
      flight: string | null;
      bracket?: number;
      Room?: { id: number; name: string } | null;
      Entries?: Record<string, { id: number; code: string; side?: number; speakerorder?: number; record?: string }>;
      Judges?: Record<string, { first: string | null; last: string | null; chair?: number }>;
    }
  >;
}

export interface ResultsIndexEvent {
  id: number;
  name: string;
  abbr: string;
  type: string;
  ResultSets: Array<{ id: number; tag: string | null; label: string | null; createdAt: string | null }>;
}

/**
 * `results` and `rounds` are both optional: upstream only populates `results`
 * for score/rank-style sets (and only when a cache produces them), while
 * `bracket` sets carry `rounds` instead and never set `results` at all. See
 * `createBracketCache` in the vendored `resultSetRepo`.
 */
export interface ResultSet {
  id: number;
  tag?: string | null;
  label: string | null;
  createdAt?: string | null;
  noPlacement?: boolean;
  Event?: { id: number; name: string; abbr: string } | null;
  /** The columns of each row's `values`, keyed like them (`"1"`, `"2"`, …). */
  headers?: Record<string, { tag?: string | null; description?: string | null }>;
  rounds?: Record<string, unknown>;
  results?: Array<{
    rank?: number | null;
    place?: string | null;
    Entry?: { id: number; code: string | null; name: string | null } | null;
    School?: { id: number; code: string | null; name: string | null } | null;
    values?: Record<string, unknown>;
  }>;
}

export class TournamentsApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** How one format is run for a tournament this app creates. */
export interface CreateEventInput {
  format: TournamentFormatId;
  /** `event.level` — the division, e.g. Open, Novice, JV. */
  level?: "open" | "novice" | "jv";
  /** `event.code_style` — how entries are written in pairings. */
  codeStyle?: string;
  /** Entries per school, or null for no cap. */
  schoolCap?: number | null;
  /** Extra text for the public invite. */
  description?: string;
  /** Entry fee, in `currency`. */
  fee?: number | null;
}

/** The body `POST {apiBase}/host/tourns` accepts. */
export interface CreateTournamentInput {
  name: string;
  webname?: string;
  scheduledType?: "virtual" | "in-person" | "long-term-online";
  venue?: string;
  city?: string;
  state?: string;
  country?: string;
  tz?: string;
  /** ISO-8601 with an offset. */
  start: string;
  /** ISO-8601 with an offset. */
  end: string;
  regStart?: string;
  regEnd?: string;
  currency?: string;
  events: CreateEventInput[];
}

export interface CreatedTournament {
  id: number;
  name: string;
  webname: string;
  start: string | null;
  end: string | null;
  tz: string | null;
  events: Array<{
    id: number;
    format: TournamentFormatId;
    abbr: string;
    name: string;
    level: string;
    codeStyle: string;
    schoolCap: number | null;
    description: string;
  }>;
  summaries: Record<string, string>;
}

/** A tournament the signed-in user owns. */
export interface OwnedTournament {
  id: number;
  name: string;
  webname: string | null;
  start: string | null;
  end: string | null;
  tz: string | null;
  hidden: boolean;
  eventCount: number;
}

/** One hosted tournament as its admins see it: `GET {apiBase}/host/tourns/:id/admin`. */
export interface TournamentAdmin {
  /** Who is looking. `mock` is the shared demo admin anyone can browse as. */
  viewer: { username: string; name: string; mock: boolean };
  tourn: {
    id: number;
    name: string;
    webname: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    tz: string | null;
    start: string | null;
    end: string | null;
    regStart: string | null;
    regEnd: string | null;
    hidden: boolean;
  };
  events: Array<{ id: number; abbr: string; name: string; type: string; level: string | null; fee: number | null; entryCount: number }>;
  schools: Array<{ id: number; name: string; code: string | null; entryCount: number }>;
  entries: Array<{ id: number; code: string | null; name: string | null; eventAbbr: string | null; schoolName: string | null; status: "active" | "dropped" | "waitlist" | "unconfirmed" }>;
  judges: Array<{ id: number; code: string | null; name: string; schoolName: string | null; active: boolean }>;
  rooms: Array<{ id: number; name: string; building: string | null }>;
  rounds: Array<{ id: number; name: number; label: string | null; type: string | null; eventAbbr: string; published: boolean; resultsPosted: boolean; sectionCount: number; start: string | null }>;
  resultSets: Array<{ id: number; label: string | null; eventAbbr: string | null; published: boolean }>;
}

export interface TournamentsClientOptions {
  /**
   * A read-only proxy to live Tabroom (e.g. `/api/tabroom-beta`). When set, the
   * upcoming list adds live tournaments, and a tournament this site does not
   * host is read from there.
   */
  liveApiBase?: string;
}

const trimBase = (base: string) => base.replace(/\/+$/, "");

export function createTournamentsClient(
  apiBase = "/api/tournaments",
  fetchImpl: typeof fetch = (...a) => fetch(...a),
  { liveApiBase }: TournamentsClientOptions = {},
) {
  const base = trimBase(apiBase);
  const live = liveApiBase ? trimBase(liveApiBase) : null;
  /** Where each tournament id was found, once known. */
  const sources = new Map<number, TournamentSource>();
  const baseOf = (source: TournamentSource) => (source === "tabroom" && live ? live : base);

  async function request<T>(root: string, path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchImpl(`${root}${path}`, { signal: init.signal, ...init });
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const body = (await res.json()) as { detail?: string; message?: string };
        detail = body.detail || body.message || detail;
      } catch {
        // not JSON
      }
      throw new TournamentsApiError(res.status, detail);
    }
    return (await res.json()) as T;
  }
  async function get<T>(root: string, path: string, signal?: AbortSignal): Promise<T> {
    return request<T>(root, path, { signal, headers: { accept: "application/json" } });
  }

  /** Reads the invite from the hosted API first, then live Tabroom, and remembers which answered. */
  async function invite(tournId: number, signal?: AbortSignal): Promise<TournamentInvite> {
    const known = sources.get(tournId);
    if (known || !live) return get<TournamentInvite>(baseOf(known ?? "hosted"), `/rest/tourns/${tournId}/invite`, signal);
    try {
      const hosted = await get<TournamentInvite>(base, `/rest/tourns/${tournId}/invite`, signal);
      sources.set(tournId, "hosted");
      return hosted;
    } catch (error) {
      if (!(error instanceof TournamentsApiError)) throw error;
      const found = await get<TournamentInvite>(live, `/rest/tourns/${tournId}/invite`, signal);
      sources.set(tournId, "tabroom");
      return found;
    }
  }

  /** The API root holding `tournId`, resolving it through the invite when not yet known. */
  async function rootFor(tournId: number, signal?: AbortSignal): Promise<string> {
    if (!live) return base;
    if (!sources.has(tournId)) await invite(tournId, signal);
    return baseOf(sources.get(tournId) ?? "hosted");
  }

  /** Makes sure the demo tournament is loaded on this site's API. */
  const ensureDemo = (signal?: AbortSignal) =>
    request<{ tournId: number; username: string }>(base, "/host/demo", {
      method: "POST",
      signal,
      headers: { accept: "application/json" },
    });

  return {
    /** Hosted tournaments (the demo first loaded if missing), then live Tabroom's, each tagged with its source. */
    upcoming: async (signal?: AbortSignal): Promise<UpcomingTournament[]> => {
      const hosted = (async () => {
        await ensureDemo(signal).catch(() => undefined);
        return get<UpcomingTournament[]>(base, "/pages/invite/upcoming", signal);
      })();
      const tabroom = live ? get<UpcomingTournament[]>(live, "/pages/invite/upcoming", signal) : Promise.resolve([]);
      const [mine, theirs] = await Promise.allSettled([hosted, tabroom]);
      if (mine.status === "rejected" && (theirs.status === "rejected" || !live)) throw mine.reason;
      const rows: UpcomingTournament[] = [];
      const seen = new Set<number>();
      for (const [result, source] of [[mine, "hosted"], [theirs, "tabroom"]] as const) {
        if (result.status !== "fulfilled" || !Array.isArray(result.value)) continue;
        for (const row of result.value) {
          if (seen.has(row.tournId)) continue;
          seen.add(row.tournId);
          if (live) sources.set(row.tournId, source);
          rows.push({ ...row, source });
        }
      }
      return rows;
    },
    invite,
    /** The entries registered in one event, when the tournament publishes its field. */
    field: async (tournId: number, eventAbbr: string, signal?: AbortSignal) =>
      get<EventField>(
        await rootFor(tournId, signal),
        `/rest/tourns/${tournId}/events/${encodeURIComponent(eventAbbr)}/field`,
        signal,
      ),
    /** Which source a tournament was read from, once its invite or the upcoming list has loaded. */
    sourceOf: (tournId: number): TournamentSource | undefined => (live ? sources.get(tournId) : "hosted"),
    rounds: async (tournId: number, signal?: AbortSignal) =>
      get<PublishedRound[]>(await rootFor(tournId, signal), `/rest/tourns/${tournId}/rounds`, signal),
    /**
     * One round's pairings. Live Tabroom serves a round only under its
     * `/results` path (which carries the same sections), so a 404 on the
     * schematic falls back to it.
     */
    round: async (tournId: number, eventAbbr: string, roundName: string, signal?: AbortSignal) => {
      const root = await rootFor(tournId, signal);
      const path = `/pages/invite/${tournId}/${encodeURIComponent(eventAbbr)}/${encodeURIComponent(roundName)}`;
      try {
        return await get<RoundSchematic>(root, path, signal);
      } catch (error) {
        if (!(error instanceof TournamentsApiError) || error.status !== 404) throw error;
        return get<RoundSchematic>(root, `${path}/results`, signal).catch(() => {
          throw error;
        });
      }
    },
    results: async (tournId: number, signal?: AbortSignal) =>
      get<Record<string, ResultsIndexEvent>>(await rootFor(tournId, signal), `/rest/tourns/${tournId}/results`, signal),
    resultSet: async (tournId: number, resultSetId: number, signal?: AbortSignal) =>
      get<ResultSet[]>(await rootFor(tournId, signal), `/rest/tourns/${tournId}/results/${resultSetId}`, signal),
    /** Where a posted document can be downloaded; Tabroom keeps them on S3. */
    fileUrl: (tournId: number, file: { id: number; filename: string | null }): string | null =>
      file.filename ? `https://s3.amazonaws.com/tabroom-files/tourns/${tournId}/postings/${file.id}/${encodeURIComponent(file.filename)}` : null,
    /** Creates a tournament owned by the signed-in user, on this site's API. */
    createTournament: (input: CreateTournamentInput, signal?: AbortSignal) =>
      request<{ tournament: CreatedTournament }>(base, "/host/tourns", {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(input),
      }).then((body) => {
        sources.set(body.tournament.id, "hosted");
        return body.tournament;
      }),
    /** The tournaments the signed-in user owns, newest first. */
    myTournaments: (signal?: AbortSignal) => get<{ tournaments: OwnedTournament[] }>(base, "/host/tourns", signal),
    /** A hosted tournament's admin view: its owner's, or the demo's as the mock admin. */
    admin: (tournId: number, signal?: AbortSignal) => get<TournamentAdmin>(base, `/host/tourns/${tournId}/admin`, signal),
    ensureDemo,
  };
}

export type TournamentsClient = ReturnType<typeof createTournamentsClient>;
