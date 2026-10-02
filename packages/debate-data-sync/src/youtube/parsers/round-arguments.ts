/**
 * @fileoverview Splits a round's argument tags (as curated in the root
 * `test/video_metadata*.json` records — e.g. `["Policy v K", "Setcol", "Fast"]`)
 * into the affirmative's 1AC arguments and the negative's 2NR arguments, and
 * carries them through the admin round-video queue inside the description.
 *
 * The queue table (`youtube_round_videos`) has no argument columns, so the
 * split is written into the queued description as two labelled lines —
 * `Aff 1AC args: …` and `Neg 2NR args: …` — which {@link parseQueuedRoundArgs}
 * reads back at publish time to fill the public `videos` row's `arg_1ac` /
 * `arg_2nr`.
 * @module @debate/data-sync/youtube/parsers/round-arguments
 */

/** Round-style tags: they describe how the round was debated, not an argument. */
const STYLE_TAGS = new Set(["fast", "lay", "trad"]);

/** Arguments the affirmative reads, whatever the matchup. */
const ALWAYS_AFF = new Set(["heg", "structural violence fw", "fem framing"]);

/** Positions only the negative runs, whatever the matchup. */
const ALWAYS_NEG = new Set([
  "da",
  "cp",
  "pic",
  "ballot pic",
  "condo",
  "theory",
  "disclosure",
  "t-subsets",
  "case turns",
  "impact turns",
  "spark",
  "wipeout",
  "death good",
  "degrowth",
]);

/** Which side of an "X v Y" matchup a specific argument belongs to. */
const FAMILY: Record<string, string> = {
  da: "policy",
  cp: "policy",
  pic: "policy",
  "case turns": "policy",
  "impact turns": "policy",
  spark: "policy",
  wipeout: "policy",
  "death good": "policy",
  degrowth: "policy",
  heg: "policy",
  "structural violence fw": "policy",
  "fem framing": "policy",
  "ballot pic": "k",
  setcol: "k",
  cap: "k",
  antiblackness: "k",
  pessimism: "k",
  afropess: "k",
  baudrillard: "k",
  psychoanalysis: "k",
  "academy k": "k",
  "racial cap k": "k",
  "fiat k": "k",
  "util k": "k",
  disability: "k",
  "fem ir": "k",
  kant: "phil",
  determinism: "phil",
  theory: "theory",
  condo: "theory",
  disclosure: "theory",
  "t-subsets": "topicality",
};

/** A round's arguments split by the side that read them. */
export interface RoundArgumentSplit {
  /** Arguments the affirmative read (the 1AC). */
  aff: string[];
  /** Arguments the negative went for (the 2NR). */
  neg: string[];
}

const MATCHUP = /^(.+?)\s+v\.?\s+(.+)$/i;

function familyOf(tag: string): string {
  const key = tag.toLowerCase();
  return FAMILY[key] ?? key;
}

/**
 * Splits argument tags into 1AC and 2NR arguments.
 *
 * - The resolution (`Resolved: …`) and round-style tags (Fast, Lay, Trad) are
 *   not arguments and are dropped.
 * - A matchup tag `"X v Y"` names the affirmative's approach then the
 *   negative's: X goes to the 1AC, Y to the 2NR.
 * - Every other tag goes to the 2NR, except affirmative-sounding ones: those
 *   in {@link ALWAYS_AFF}, and a K or phil argument in a round whose
 *   matchup puts that family on the aff side only (`K v T-Framework` +
 *   `Setcol` is a Setcol aff).
 * - A matchup side is dropped when a specific argument on the same side
 *   already names it (`Policy v Policy` + `DA` gives a 2NR of `DA`, not
 *   `Policy, DA`).
 */
export function splitRoundArguments(tags: readonly string[]): RoundArgumentSplit {
  let affSide: string | null = null;
  let negSide: string | null = null;
  const specifics: string[] = [];

  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag || /^resolved\b/i.test(tag) || STYLE_TAGS.has(tag.toLowerCase())) continue;
    const matchup = tag.match(MATCHUP);
    if (matchup && affSide === null) {
      affSide = matchup[1].trim();
      negSide = matchup[2].trim();
      continue;
    }
    specifics.push(tag);
  }

  const affFamily = affSide ? familyOf(affSide) : null;
  const negFamily = negSide ? familyOf(negSide) : null;
  const aff: string[] = [];
  const neg: string[] = [];

  for (const tag of specifics) {
    const key = tag.toLowerCase();
    if (ALWAYS_AFF.has(key)) aff.push(tag);
    else if (ALWAYS_NEG.has(key)) neg.push(tag);
    else if (affFamily && familyOf(tag) === affFamily && familyOf(tag) !== negFamily) aff.push(tag);
    else neg.push(tag);
  }

  if (affSide && !aff.some((tag) => familyOf(tag) === affFamily)) aff.unshift(affSide);
  if (negSide && !neg.some((tag) => familyOf(tag) === negFamily)) neg.unshift(negSide);

  return { aff, neg };
}

const AFF_LINE = "Aff 1AC args:";
const NEG_LINE = "Neg 2NR args:";

/** The labelled description lines carrying a split into the queue. */
export function formatRoundArgumentLines(split: RoundArgumentSplit): string[] {
  const lines: string[] = [];
  if (split.aff.length) lines.push(`${AFF_LINE} ${split.aff.join(", ")}`);
  if (split.neg.length) lines.push(`${NEG_LINE} ${split.neg.join(", ")}`);
  return lines;
}

function readLine(description: string, label: string): string | null {
  for (const line of description.split(/\r?\n/)) {
    if (line.startsWith(label)) {
      const value = line.slice(label.length).trim();
      return value || null;
    }
  }
  return null;
}

/**
 * Reads the 1AC / 2NR arguments back out of a queued round's description —
 * `null` for a side its description does not label (every YouTube-resynced
 * round, which carries no curated arguments).
 */
export function parseQueuedRoundArgs(description: string | null | undefined): {
  arg1ac: string | null;
  arg2nr: string | null;
} {
  if (!description) return { arg1ac: null, arg2nr: null };
  return { arg1ac: readLine(description, AFF_LINE), arg2nr: readLine(description, NEG_LINE) };
}
