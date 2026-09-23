/**
 * Typed fetches against the tournaments API (`createTournamentsHandler`),
 * for the React UI. Shapes are upstream Tabroom's public responses, narrowed
 * to the fields the UI reads.
 */

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

export interface ResultSet {
  id: number;
  label: string | null;
  Event?: { id: number; name: string; abbr: string } | null;
  results: Array<{
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

export function createTournamentsClient(apiBase = "/api/tournaments", fetchImpl: typeof fetch = (...a) => fetch(...a)) {
  const base = apiBase.replace(/\/+$/, "");
  async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const res = await fetchImpl(`${base}${path}`, { signal, headers: { accept: "application/json" } });
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
  return {
    upcoming: (signal?: AbortSignal) => get<UpcomingTournament[]>("/pages/invite/upcoming", signal),
    invite: (tournId: number, signal?: AbortSignal) => get<TournamentInvite>(`/rest/tourns/${tournId}/invite`, signal),
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
  };
}

export type TournamentsClient = ReturnType<typeof createTournamentsClient>;
