/**
 * @fileoverview The openCaselist catalog: which caselists exist, what a
 * caselist slug means, and where its bulk archives live.
 *
 * openCaselist publishes one caselist per event per season — `hspolicy26`,
 * `ndtceda26`, `hsld26`, `hspf26`, `nfald26` for 2026-27 — and every one of
 * them serves the identical `/{slug}/downloads` page and the identical
 * archive URLs underneath. Nothing downstream of this file hardcodes a slug:
 * the parser, the fetcher and the CLI all take one, so a new season is a
 * two-character change to {@link CURRENT_SEASON} rather than a new scraper.
 *
 * @module caselist/caselist-config
 */

/** The debate event a caselist covers. */
export type CaselistEvent = "policy" | "ld" | "pf";

/** Whether a caselist is high school, college, or NFA collegiate LD. */
export type CaselistLevel = "hs" | "college";

/** One openCaselist caselist, identified by its URL slug. */
export interface Caselist {
  /** URL slug, e.g. `hspolicy26`. The identity everything else keys on. */
  slug: string;
  /** Human label, e.g. `HS Policy 2026-27`. */
  label: string;
  event: CaselistEvent;
  level: CaselistLevel;
  /** Opening calendar year of the season, e.g. `2026` for 2026-27. */
  year: number;
}

/**
 * The season this build knows about, as the two digits a slug carries.
 *
 * openCaselist's slugs are `<family><2-digit year>`, so bumping this rolls
 * every caselist in {@link CASELIST_FAMILIES} forward together.
 */
export const CURRENT_SEASON = 26;

/**
 * The season-independent half of each caselist slug.
 *
 * Keyed by family rather than by full slug so the same table serves last
 * season's archives (`hspolicy25`) and next season's without edits.
 */
export const CASELIST_FAMILIES = [
  { family: "hspolicy", label: "HS Policy", event: "policy", level: "hs" },
  { family: "hsld", label: "HS LD", event: "ld", level: "hs" },
  { family: "hspf", label: "HS PF", event: "pf", level: "hs" },
  { family: "ndtceda", label: "NDT/CEDA College", event: "policy", level: "college" },
  { family: "nfald", label: "NFA College LD", event: "ld", level: "college" },
] as const satisfies readonly {
  family: string;
  label: string;
  event: CaselistEvent;
  level: CaselistLevel;
}[];

/** A caselist family name, e.g. `hspolicy`. */
export type CaselistFamily = (typeof CASELIST_FAMILIES)[number]["family"];

/**
 * Expands a two-digit season into the label openCaselist prints, e.g.
 * `26` → `2026-27`.
 *
 * @param season - Two-digit opening year of the season.
 * @returns The `YYYY-YY` season label.
 */
export function seasonLabel(season: number): string {
  const start = 2000 + season;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/**
 * Builds the caselist descriptor for a family and season.
 *
 * @param family - Season-independent slug half, e.g. `hsld`.
 * @param season - Two-digit opening year, defaulting to {@link CURRENT_SEASON}.
 * @returns The caselist, or `null` when the family is not one openCaselist runs.
 */
export function caselistFor(
  family: string,
  season: number = CURRENT_SEASON,
): Caselist | null {
  const entry = CASELIST_FAMILIES.find((candidate) => candidate.family === family);
  if (!entry) return null;
  return {
    slug: `${entry.family}${String(season).padStart(2, "0")}`,
    label: `${entry.label} ${seasonLabel(season)}`,
    event: entry.event,
    level: entry.level,
    year: 2000 + season,
  };
}

/**
 * Every caselist openCaselist runs for a season.
 *
 * @param season - Two-digit opening year, defaulting to {@link CURRENT_SEASON}.
 * @returns One descriptor per family, in catalog order.
 */
export function caselistsForSeason(season: number = CURRENT_SEASON): Caselist[] {
  return CASELIST_FAMILIES.map((entry) => caselistFor(entry.family, season)).filter(
    (caselist): caselist is Caselist => caselist !== null,
  );
}

/**
 * Reads a slug back into a caselist descriptor.
 *
 * Accepts a bare slug (`hspolicy26`), a caselist path (`/hspolicy26/downloads`)
 * or a full openCaselist URL, so a slug pasted from the address bar works
 * without trimming.
 *
 * @param slug - The slug, path or URL to resolve.
 * @returns The caselist, or `null` when the slug names no known family.
 */
export function parseCaselistSlug(slug: string): Caselist | null {
  const bare = String(slug)
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .split("/")
    .filter(Boolean)[0];
  const match = /^([a-z]+)(\d{2})$/i.exec(bare ?? "");
  if (!match) return null;
  return caselistFor(match[1].toLowerCase(), Number.parseInt(match[2], 10));
}

/** Site the caselists are published on. */
export const CASELIST_ORIGIN = "https://opencaselist.com";

/**
 * Bucket the weekly archives are served from.
 *
 * Public, unauthenticated and CORS-open — the downloads page links straight at
 * it, so a sync never needs an openCaselist session to pull an archive, only
 * to discover one.
 */
export const CASELIST_FILES_ORIGIN =
  "https://caselist-files.s3.us-east-005.backblazeb2.com";

/**
 * URL of a caselist's bulk downloads page.
 *
 * @param slug - Caselist slug, e.g. `ndtceda26`.
 * @returns The `/{slug}/downloads` URL.
 */
export function downloadsPageUrl(slug: string): string {
  return `${CASELIST_ORIGIN}/${slug}/downloads`;
}

/** Which of the two archives a file is: the season dump, or one week's delta. */
export type CaselistArchiveKind = "all" | "weekly";

/**
 * URL of one bulk archive.
 *
 * The bucket layout is positional — `weekly/{slug}/{slug}-{kind}-{date}.zip`
 * for both kinds, the `all` dump included — so this is the one place that
 * shape is written down.
 *
 * @param slug - Caselist slug.
 * @param kind - `all` for the season dump, `weekly` for one week's files.
 * @param date - Archive date as `YYYY-MM-DD`.
 * @returns The archive's absolute URL.
 */
export function archiveUrl(
  slug: string,
  kind: CaselistArchiveKind,
  date: string,
): string {
  return `${CASELIST_FILES_ORIGIN}/weekly/${slug}/${slug}-${kind}-${date}.zip`;
}
