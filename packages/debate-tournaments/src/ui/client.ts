/**
 * Typed fetches against the tournaments API (`createTournamentsHandler`),
 * for the React UI. Shapes are upstream Tabroom's public responses, narrowed
 * to the fields the UI reads, plus this app's own `/host` create endpoints.
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
}

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

export function createTournamentsClient(apiBase = "/api/tournaments", fetchImpl: typeof fetch = (...a) => fetch(...a)) {
  const base = apiBase.replace(/\/+$/, "");
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchImpl(`${base}${path}`, { signal: init.signal, ...init });
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
  async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { signal, headers: { accept: "application/json" } });
  }
  return {
    upcoming: (signal?: AbortSignal) => get<UpcomingTournament[]>("/pages/invite/upcoming", signal),
    invite: (tournId: number, signal?: AbortSignal) => get<TournamentInvite>(`/rest/tourns/${tournId}/invite`, signal),
    /** The entries registered in one event, when the tournament publishes its field. */
    field: (tournId: number, eventAbbr: string, signal?: AbortSignal) =>
      get<EventField>(`/rest/tourns/${tournId}/events/${encodeURIComponent(eventAbbr)}/field`, signal),
    rounds: (tournId: number, signal?: AbortSignal) => get<PublishedRound[]>(`/rest/tourns/${tournId}/rounds`, signal),
    round: (tournId: number, eventAbbr: string, roundName: string, signal?: AbortSignal) =>
      get<RoundSchematic>(
        `/pages/invite/${tournId}/${encodeURIComponent(eventAbbr)}/${encodeURIComponent(roundName)}`,
        signal,
      ),
    results: (tournId: number, signal?: AbortSignal) =>
      get<Record<string, ResultsIndexEvent>>(`/rest/tourns/${tournId}/results`, signal),
    resultSet: (tournId: number, resultSetId: number, signal?: AbortSignal) =>
      get<ResultSet[]>(`/rest/tourns/${tournId}/results/${resultSetId}`, signal),
    /** Creates a tournament owned by the signed-in user. */
    createTournament: (input: CreateTournamentInput, signal?: AbortSignal) =>
      request<{ tournament: CreatedTournament }>("/host/tourns", {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(input),
      }).then((body) => body.tournament),
    /** The tournaments the signed-in user owns, newest first. */
    myTournaments: (signal?: AbortSignal) => get<{ tournaments: OwnedTournament[] }>("/host/tourns", signal),
  };
}

export type TournamentsClient = ReturnType<typeof createTournamentsClient>;
