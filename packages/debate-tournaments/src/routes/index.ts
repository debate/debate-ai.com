/**
 * The tournaments UI's route table, shared by the host app (which mounts one
 * catch-all page, e.g. `app/tournaments/[[...slug]]/page.tsx`) and by
 * `TournamentsApp`, which renders the matching page.
 *
 * Paths follow upstream Tabroom's `/invite/[tourn]/…` pages, with the
 * `/invite` segment dropped.
 */

export type TournamentRoute =
  | { page: "upcoming" }
  | { page: "tournament"; tournId: number }
  | { page: "rounds"; tournId: number }
  | { page: "round"; tournId: number; eventAbbr: string; roundName: string }
  | { page: "results"; tournId: number }
  | { page: "resultSet"; tournId: number; resultSetId: number }
  | { page: "notFound" };

/** Route patterns, relative to the mount path, for docs and sitemaps. */
export const TOURNAMENT_ROUTE_PATTERNS = {
  upcoming: "/",
  tournament: "/:tournId",
  rounds: "/:tournId/rounds",
  round: "/:tournId/rounds/:eventAbbr/:roundName",
  results: "/:tournId/results",
  resultSet: "/:tournId/results/:resultSetId",
} as const;

const id = (s: string | undefined) => (s && /^\d+$/.test(s) ? Number(s) : null);

/** Resolves the path segments after the mount path to a route. */
export function matchTournamentRoute(segments: readonly string[] = []): TournamentRoute {
  const parts = segments.filter(Boolean).map((s) => decodeURIComponent(s));
  if (parts.length === 0) return { page: "upcoming" };
  const tournId = id(parts[0]);
  if (tournId === null) return { page: "notFound" };
  const [, section, a, b] = parts;
  if (!section && parts.length === 1) return { page: "tournament", tournId };
  if (section === "rounds") {
    if (parts.length === 2) return { page: "rounds", tournId };
    if (parts.length === 4 && a && b) return { page: "round", tournId, eventAbbr: a, roundName: b };
  }
  if (section === "results") {
    if (parts.length === 2) return { page: "results", tournId };
    const resultSetId = id(a);
    if (parts.length === 3 && resultSetId !== null) return { page: "resultSet", tournId, resultSetId };
  }
  return { page: "notFound" };
}

/** Builds hrefs under `basePath` (default `/tournaments`). */
export function tournamentHrefs(basePath = "/tournaments") {
  const base = basePath.replace(/\/+$/, "");
  const enc = encodeURIComponent;
  return {
    upcoming: () => base || "/",
    tournament: (tournId: number) => `${base}/${tournId}`,
    rounds: (tournId: number) => `${base}/${tournId}/rounds`,
    round: (tournId: number, eventAbbr: string, roundName: string | number) =>
      `${base}/${tournId}/rounds/${enc(eventAbbr)}/${enc(String(roundName))}`,
    results: (tournId: number) => `${base}/${tournId}/results`,
    resultSet: (tournId: number, resultSetId: number) => `${base}/${tournId}/results/${resultSetId}`,
  };
}

export type TournamentHrefs = ReturnType<typeof tournamentHrefs>;
