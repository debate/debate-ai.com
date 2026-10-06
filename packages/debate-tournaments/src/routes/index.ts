/**
 * The tournaments UI's route table, shared by the host app (which mounts one
 * catch-all page, e.g. `app/tournaments/[[...slug]]/page.tsx`) and by
 * `TournamentsApp`, which renders the matching page.
 *
 * Paths follow upstream Tabroom's `/invite/[tourn]/…` pages, with the
 * `/invite` segment dropped. A tournament is addressed by the year it starts
 * and a slug of its name — `/2026/yale-invitational/results` — and the UI
 * resolves that pair to the Tabroom tourn id. The bare id form
 * (`/38436/results`) still matches, for links built before a tournament's name
 * is known; the UI swaps it for the named form once the tournament loads.
 */

/** How a URL names a tournament: by its Tabroom id, or by start year and name slug. */
export type TournamentKey = { tournId: number } | { year: number; slug: string };

/** The year and name slug a tournament is addressed by. */
export interface TournamentSlug {
  year: number;
  slug: string;
}

export type TournamentRoute =
  | { page: "upcoming" }
  | { page: "host" }
  | { page: "tournament"; tourn: TournamentKey }
  | { page: "rounds"; tourn: TournamentKey }
  | { page: "round"; tourn: TournamentKey; eventAbbr: string; roundName: string }
  | { page: "results"; tourn: TournamentKey }
  | { page: "resultSet"; tourn: TournamentKey; resultSetId: number }
  | { page: "tabroom"; tourn: TournamentKey }
  | { page: "admin"; tourn: TournamentKey }
  | { page: "notFound" };

/** A route that names one tournament. */
export type TournamentPageRoute = Extract<TournamentRoute, { tourn: TournamentKey }>;

/** Route patterns, relative to the mount path, for docs and sitemaps. */
export const TOURNAMENT_ROUTE_PATTERNS = {
  upcoming: "/",
  host: "/host",
  tournament: "/:year/:slug",
  rounds: "/:year/:slug/rounds",
  round: "/:year/:slug/rounds/:eventAbbr/:roundName",
  results: "/:year/:slug/results",
  resultSet: "/:year/:slug/results/:resultSetId",
  tabroom: "/:year/:slug/tabroom",
  admin: "/:year/:slug/admin",
} as const;

const SECTIONS = new Set(["rounds", "results", "tabroom", "admin"]);

const id = (s: string | undefined) => (s && /^\d+$/.test(s) ? Number(s) : null);
const year = (s: string | undefined) => (s && /^\d{4}$/.test(s) ? Number(s) : null);

/**
 * The URL slug of a tournament name: lowercase ASCII words joined by hyphens,
 * so "Yale Invitational" is `yale-invitational`.
 */
export function tournamentSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The year and slug a tournament is addressed by, from its name and start
 * date (the UTC year of `start`). Null when either is missing, or the name has
 * no letters or digits to slug.
 */
export function tournamentSlugOf(tourn: { name?: string | null; start?: string | null }): TournamentSlug | null {
  if (!tourn.name || !tourn.start) return null;
  const y = new Date(tourn.start).getUTCFullYear();
  const slug = tournamentSlug(tourn.name);
  return Number.isFinite(y) && slug ? { year: y, slug } : null;
}

/** Resolves the path segments after the mount path to a route. */
export function matchTournamentRoute(segments: readonly string[] = []): TournamentRoute {
  const parts = segments.filter(Boolean).map((s) => decodeURIComponent(s));
  if (parts.length === 0) return { page: "upcoming" };
  if (parts[0] === "host") return parts.length === 1 ? { page: "host" } : { page: "notFound" };

  // `/<year>/<slug>/…`, unless the second segment is a section of a
  // tournament addressed by a four-digit id (`/5000/results`).
  let tourn: TournamentKey;
  let rest: string[];
  const y = year(parts[0]);
  const second = parts[1];
  if (y !== null && second && !SECTIONS.has(second) && id(second) === null) {
    tourn = { year: y, slug: second.toLowerCase() };
    rest = parts.slice(2);
  } else {
    const tournId = id(parts[0]);
    if (tournId === null) return { page: "notFound" };
    tourn = { tournId };
    rest = parts.slice(1);
  }

  const [section, a, b] = rest;
  if (!section) return { page: "tournament", tourn };
  if (section === "rounds") {
    if (rest.length === 1) return { page: "rounds", tourn };
    if (rest.length === 3 && a && b) return { page: "round", tourn, eventAbbr: a, roundName: b };
  }
  if (section === "results") {
    if (rest.length === 1) return { page: "results", tourn };
    const resultSetId = id(a);
    if (rest.length === 2 && resultSetId !== null) return { page: "resultSet", tourn, resultSetId };
  }
  if (section === "tabroom" && rest.length === 1) return { page: "tabroom", tourn };
  if (section === "admin" && rest.length === 1) return { page: "admin", tourn };
  return { page: "notFound" };
}

/**
 * Builds hrefs under `basePath` (default `/tournaments`). `slugOf` names a
 * tournament by id; one it knows is linked as `/<year>/<slug>`, any other by
 * its id, which the UI resolves and then rewrites to the named form.
 */
export function tournamentHrefs(
  basePath = "/tournaments",
  slugOf: (tournId: number) => TournamentSlug | null | undefined = () => null,
) {
  const base = basePath.replace(/\/+$/, "");
  const enc = encodeURIComponent;
  const at = (tournId: number) => {
    const named = slugOf(tournId);
    return named ? `${base}/${named.year}/${enc(named.slug)}` : `${base}/${tournId}`;
  };
  const hrefs = {
    upcoming: () => base || "/",
    host: () => `${base}/host`,
    tournament: (tournId: number) => at(tournId),
    rounds: (tournId: number) => `${at(tournId)}/rounds`,
    round: (tournId: number, eventAbbr: string, roundName: string | number) =>
      `${at(tournId)}/rounds/${enc(eventAbbr)}/${enc(String(roundName))}`,
    results: (tournId: number) => `${at(tournId)}/results`,
    resultSet: (tournId: number, resultSetId: number) => `${at(tournId)}/results/${resultSetId}`,
    tabroom: (tournId: number) => `${at(tournId)}/tabroom`,
    admin: (tournId: number) => `${at(tournId)}/admin`,
    /** The href of `route`'s page for the tournament it resolved to. */
    forRoute: (route: TournamentPageRoute, tournId: number): string => {
      switch (route.page) {
        case "round":
          return hrefs.round(tournId, route.eventAbbr, route.roundName);
        case "resultSet":
          return hrefs.resultSet(tournId, route.resultSetId);
        default:
          return hrefs[route.page](tournId);
      }
    },
  };
  return hrefs;
}

export type TournamentHrefs = ReturnType<typeof tournamentHrefs>;
