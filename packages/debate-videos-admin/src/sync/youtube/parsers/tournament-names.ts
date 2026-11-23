/**
 * @fileoverview The library's names for tournaments that titles spell many
 * ways: "Tournament of Champions", "TOC" and "the TOC" are all "TOC";
 * "Cal", "California" and "UC Berkeley" are all "Berkeley".
 *
 * Only whole names are matched (after case, punctuation and a leading "the"
 * are ignored), so "California State Championship" stays as written and only
 * a bare "California" becomes "Berkeley". A name with no entry is returned as
 * written, minus a stray year.
 *
 * Round robins keep their host's name with "Round Robin" after it ("HWL RR"
 * → "Harvard-Westlake Round Robin"), matching how the library files them.
 * @module sync/youtube/parsers/tournament-names
 */

import { stripTournamentYear } from "@debate-ai/videos/src/data/video-rows";

/** Canonical name → the other ways titles write it (lower case, words only). */
const TOURNAMENT_ALIASES: Record<string, string[]> = {
  TOC: ["toc", "tournament of champions", "uk toc", "university of kentucky tournament of champions", "uk tournament of champions"],
  "NSDA Nationals": [
    "nats",
    "nationals",
    "nsda",
    "nsda nats",
    "nsda nationals",
    "nsda national tournament",
    "nsda national championship",
    "nsda national championships",
    "national speech and debate tournament",
    "national speech debate tournament",
    "nfl nationals",
  ],
  "NDCA National Championship": [
    "ndca",
    "ndca nats",
    "ndca nationals",
    "ndca national championship",
    "ndca national championships",
    "ndca championship",
    "ndca championships",
  ],
  NCFL: ["ncfl", "ncfl nationals", "ncfl grand nationals", "cfl nationals", "catholic nationals", "grand nationals"],
  "Harvard-Westlake": ["hw", "hwl", "hw debates", "harvard westlake", "harvard westlake debates", "harvard westlake invitational"],
  Berkeley: ["cal", "berkeley", "cal berkeley", "uc berkeley", "california", "cal invitational", "berkeley invitational", "berkley", "california invitational", "california invitational at uc berkeley", "california invitational at berkeley"],
  Bronx: ["bronx", "bronx science", "bronx science invitational", "bronx invitational", "new york city invitational", "nyc invitational", "nyci"],
  Loyola: ["loyola", "loyola invitational", "loyola invitational tournament"],
  Glenbrooks: ["glenbrooks", "glenbrook", "gbx", "gbs", "glenbrooks invitational", "glenbrooks speech and debate tournament"],
  Emory: ["emory", "barkley forum", "emory barkley forum", "barkley forum for high schools"],
  Harvard: ["harvard", "harvard invitational", "harvard national forensics tournament"],
  Yale: ["yale", "yale invitational"],
  Stanford: ["stanford", "stanford invitational"],
  Princeton: ["princeton", "princeton classic"],
  "College Prep": ["cps", "college prep", "college prep invitational"],
  "Florida Blue Key": ["fbk", "blue key", "florida blue key", "florida blue key speech and debate tournament"],
  "Longhorn Classic": ["ut", "ut austin", "longhorn", "longhorn classic", "texas longhorn classic", "university of texas", "university of texas at austin"],
  King: ["king", "kandi king"],
  "Lake Highland": ["lhp", "lake highland", "lake highland prep"],
  "Nano Nagle": ["nano nagle", "presentation", "nano nagle presentation"],
  "Heart of Texas Invitational": ["hot", "heart of texas", "heart of texas invitational", "st marks", "st mark s"],
  "Meadows Invitational": ["meadows", "the meadows", "meadows invitational"],
  "Arizona State": ["asu", "arizona state"],
  "USC Trojan Invitational": ["usc", "usc trojan", "usc trojan invitational"],
  "Mid America Cup": ["mac", "mid america cup"],
  "Classic Debate Camp Tournament": ["cdc", "classic debate camp", "classic debate camp tournament"],
  "Apple Valley": ["av", "apple valley", "apple valley invitational"],
  "Damus Hollywood Invitational": ["damus hollywood", "damus hollywood invitational"],
  "MLK James Logan": ["james logan", "mlk james logan"],
  "TFA State": ["tfa state", "tfa state championship", "tfa state tournament"],
  "Strake Jesuit": ["strake", "strake jesuit", "strake jesuit invitational"],
  "University of Houston": ["uh", "university of houston"],
  "NSDA Springboard December Capstone Tournament": [
    "springboard december capstone",
    "springboard capstone",
    "nsda springboard capstone",
    "nsda springboard december capstone",
  ],
  UNLV: ["unlv", "unlv invitational"],
  "ISSDA States": ["issda", "issda state", "issda states"],
  NDT: ["ndt", "national debate tournament"],
  CEDA: ["ceda", "ceda nationals"],
  "Wake Forest": ["wake", "wake forest", "wake forest early bird"],
};

/** "Tournament of Champions!" → "tournament of champions". */
function aliasKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^the\s+/, "")
    .trim();
}

const CANONICAL_BY_ALIAS = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(TOURNAMENT_ALIASES)) {
  CANONICAL_BY_ALIAS.set(aliasKey(canonical), canonical);
  for (const alias of aliases) CANONICAL_BY_ALIAS.set(aliasKey(alias), canonical);
}

/** Every alias, longest first, for finding a tournament at the start of a phrase. */
const ALIAS_KEYS = [...CANONICAL_BY_ALIAS.keys()].sort((a, b) => b.length - a.length);

/** A trailing "Round Robin" / "RR" on a tournament name. */
const ROUND_ROBIN_SUFFIX = /\s*(?:\(\s*)?\b(?:round\s*robin|rr)\b(?:\s*\))?\s*$/i;

/**
 * The library's name for a tournament, or `null` for blank.
 *
 * @param name - The tournament as written, with or without a year.
 */
export function canonicalTournament(name: string | null | undefined): string | null {
  const stripped = stripTournamentYear(name?.replace(/\s+/g, " ").trim() || null);
  if (!stripped) return null;
  const roundRobin = ROUND_ROBIN_SUFFIX.test(stripped);
  const base = roundRobin ? stripped.replace(ROUND_ROBIN_SUFFIX, "").trim() : stripped;
  if (!base) return roundRobin ? "Round Robin" : null;
  const canonical = CANONICAL_BY_ALIAS.get(aliasKey(base)) ?? base;
  return roundRobin ? `${canonical} Round Robin` : canonical;
}

/**
 * The number of leading words of `words` that name a known tournament
 * ("UNLV Damien ND" → 1), or 0. Used to split a tournament off the front of a
 * team name when a title runs them together.
 */
export function leadingTournamentWords(words: string[]): number {
  const key = aliasKey(words.join(" "));
  for (const alias of ALIAS_KEYS) {
    if (alias.length < 3) continue; // "hw", "av", "ut" are too common as school words
    if (key === alias || key.startsWith(`${alias} `)) return alias.split(" ").length;
  }
  return 0;
}

/** The canonical names, for the model prompt. */
export const KNOWN_TOURNAMENTS: readonly string[] = Object.keys(TOURNAMENT_ALIASES);
