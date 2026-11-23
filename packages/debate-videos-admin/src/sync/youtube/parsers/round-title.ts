/**
 * @fileoverview Reads a round video's title the way uploaders actually write
 * them, in any order:
 *
 * - "2024 Tournament of Champions LD R4: Horace Greeley SG vs OCSA IL"
 * - "Blake TP vs. Seven Lakes LM TOC Octos 2023"
 * - "NSDA Nationals 2025 | Round 9 | BASIS Peoria GV vs. SF Jefferson WH | Public Forum Debate"
 * - "Loyola 2020 Doubles - Aff Strake Jesuit BE vs. Neg Southlake Carroll PK"
 * - "Strake Jesuit DY (Neg 2nd) VS Seven Lakes ML (Aff 1st) Harvard Round Robin Semis"
 *
 * The two teams are found first, around the "vs" / "v.": a team runs from
 * the nearest separator, round word, format word or year up to the "vs", and
 * from the "vs" up to its entry code ("Seven Lakes LM", the two or three
 * capitals at the end of a high-school team). Taking the teams out first
 * keeps a code like "Cary Academy RR" from reading as "Round Robin". What is
 * left is the tournament, the round and the format, read from any position.
 *
 * Sides: a title that marks them ("(Aff)", "Aff X vs Neg Y", "X (Neg 2nd)")
 * is followed, swapping the order if the negative is named first. Otherwise
 * the first-named team is the affirmative, as the YouTube sync has always
 * filed them, and `sidesStated` is false.
 *
 * Round levels come out in the library's spelling: "R4", "Doubles",
 * "Octafinals", "Quarterfinals", "Semifinals", "Finals", "Round Robin".
 * Tournament names go through `canonicalTournament`.
 * @module sync/youtube/parsers/round-title
 */

import { canonicalTournament, leadingTournamentWords } from "./tournament-names";

export interface RoundTitleReading {
  tournament: string | null;
  roundLevel: string | null;
  affTeam: string | null;
  negTeam: string | null;
  /** Whether the title marks which team was affirmative. */
  sidesStated: boolean;
  /** The season year the title names, if any. */
  year: number | null;
}

/** Stands in for any separator ("|", " - ", "--", ": ", brackets). */
const SEP = "¦";
const AFF = "⟨AFF⟩";
const NEG = "⟨NEG⟩";

/** The library's round level for one phrase, or `null`. Order matters: "Double Octos" before "Octos". */
const ROUND_PATTERNS: Array<[RegExp, string | ((m: RegExpMatchArray) => string)]> = [
  [/\btriple[\s-]*(?:octo|octa)(?:s|finals?)?\b|\btriples?\b|\btrips\b/i, "Triples"],
  [/\bdouble[\s-]*(?:octo|octa)(?:s|finals?)?\b|\bdoubles?\b|\bdubs\b|\bdouble\s+octos?\b/i, "Doubles"],
  [/\bpartial[\s-]*(?:octo|octa)(?:s|finals?)?\b/i, "Octafinals"],
  [/\b(?:octo|octa)(?:s|finals?|[\s-]finals?)?\b/i, "Octafinals"],
  [/\bquarter(?:s|finals?|[\s-]finals?)?\b|\bqf\b|\bqtrs\b/i, "Quarterfinals"],
  [/\bsemi(?:s|finals?|[\s-]finals?)?\b|\bsf\s+(?=round)/i, "Semifinals"],
  [/\b(?:grand\s+)?finals?\b|\bfinal\s+round\b|\bchampionship\s+round\b(?!\s*\d)/i, "Finals"],
  [/\brun[\s-]?offs?\b/i, "Runoffs"],
  [/\b(?:round|rd\.?|r)\s*0?(\d{1,2})\b/i, (m) => `R${Number(m[1])}`],
];

const ROUND_ROBIN = /\bround[\s-]*robin\b|\bRR\b/i;

/**
 * The library's spelling of a round level written any common way, or `null`.
 * "Round 4" → "R4", "Double Octafinals" → "Doubles", "Semis" → "Semifinals".
 * A round-robin round stays "Round Robin", as the library files them.
 */
export function canonicalRoundLevel(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  if (/^round[\s-]*robin$/i.test(text) || /^rr$/i.test(text)) return "Round Robin";
  for (const [pattern, level] of ROUND_PATTERNS) {
    const match = text.match(pattern);
    if (match) return typeof level === "string" ? level : level(match);
  }
  return null;
}

/** Round, format and filler words: a team name never runs across one. */
const STOP_WORD =
  /^(?:finals?|semis?|semifinals?|semi-finals?|quarters?|quarterfinals?|quarter-finals?|octos?|octas?|octafinals?|octofinals?|doubles?|triples?|runoffs?|r\d{1,2}|rd\.?|rd\d{1,2}|round|robin|elims?|prelims?|ld|vld|jvld|nld|pf|pfd|vpf|cx|policy|lincoln-douglas|forum|ndt|ceda)$/i;

const YEAR_TOKEN = /^(?:19[5-9]\d|20[0-4]\d)$|^'\d{2}$/;

/**
 * A high-school entry code: "SG", "OCSA"-style school words are longer, so
 * two or three capitals ("LM", "SSh" is two capitals and a lower).
 */
const ENTRY_CODE = /^(?:[A-Z]{2,3}|[A-Z]{2}[a-z])$/;

/** "(Aff)", "(Neg 2nd)", "Aff", "Neg:" → the side, else `null`. */
function sideOf(token: string): "aff" | "neg" | null {
  if (token === AFF) return "aff";
  if (token === NEG) return "neg";
  if (/^aff(?:irmative)?:?$/i.test(token)) return "aff";
  if (/^neg(?:ative)?:?$/i.test(token)) return "neg";
  return null;
}

function isStop(token: string): boolean {
  return token === SEP || STOP_WORD.test(token) || YEAR_TOKEN.test(token) || /^\d+$/.test(token);
}

/** Spacing and punctuation tidy for a team name. */
function tidyTeam(tokens: string[]): string | null {
  const team = tokens
    .join(" ")
    .replace(/^[\s,.;:#-]+|[\s,.;:#-]+$/g, "")
    .replace(/\bPreparatory\b/g, "Prep")
    .replace(/\s+/g, " ")
    .trim();
  return team || null;
}

/**
 * The title with separators, side markers and brackets turned into single
 * tokens, and the year (if any) noted.
 */
function tokenize(title: string): { tokens: string[]; year: number | null } {
  let text = title
    .normalize("NFKC")
    .replace(/[│｜┃]/g, "|")
    .replace(/\s*[–—]\s*/g, " - ");

  let year: number | null = null;
  const yearMatch = text.match(/(?:^|[^\d])((?:19[5-9]|20[0-4])\d)(?!\d)/);
  if (yearMatch) year = Number(yearMatch[1]);

  text = text
    // Side markers: "(Aff)", "(Neg 2nd)", "(Affirmative)".
    .replace(/\(\s*aff(?:irmative)?(?:\s*(?:1st|2nd|first|second))?\s*\)/gi, ` ${AFF} `)
    .replace(/\(\s*neg(?:ative)?(?:\s*(?:1st|2nd|first|second))?\s*\)/gi, ` ${NEG} `)
    // Brackets and other parentheses are separators around their content.
    .replace(/[[\]()]/g, ` ${SEP} `)
    // A year glued to a name ("CDC2024", "TOC21" is left alone).
    .replace(/([A-Za-z])((?:19[5-9]|20[0-4])\d)\b/g, "$1 $2")
    .replace(/\s*\|\s*/g, ` ${SEP} `)
    .replace(/\s*--+\s*/g, ` ${SEP} `)
    .replace(/\s+-\s+|\s+-(?=\S)|(?<=\S)-\s+/g, ` ${SEP} `)
    .replace(/:\s+|:$/g, ` ${SEP} `)
    .replace(/,\s+/g, ` ${SEP} `);

  const tokens = text.split(/\s+/).filter(Boolean);
  return { tokens, year };
}

/** The index of the "vs" token, or -1. */
function findVs(tokens: string[]): number {
  return tokens.findIndex((token) => /^(?:vs?\.?|versus)$/i.test(token));
}

/** Lecture-style words: a title with them is not read for teams around a "v". */
const NOT_A_MATCHUP = /\b(?:policy|k|phil|theory|trad|larp|tricks)\s+v\.?\s+(?:policy|k|phil|theory|trad|larp|tricks)\b/i;

/**
 * Reads the tournament, round and teams from a round video's title.
 *
 * @param title - The YouTube title as uploaded.
 */
export function readRoundTitle(title: string): RoundTitleReading {
  const { tokens, year } = tokenize(title);
  const used = new Array(tokens.length).fill(false);
  let affTeam: string | null = null;
  let negTeam: string | null = null;
  let sidesStated = false;

  const vs = NOT_A_MATCHUP.test(title) ? -1 : findVs(tokens);
  if (vs > 0 && vs < tokens.length - 1) {
    used[vs] = true;

    // Left team: walk back from the "vs".
    let leftSide: "aff" | "neg" | null = null;
    let i = vs - 1;
    if (sideOf(tokens[i]) && tokens[i].startsWith("⟨")) {
      leftSide = sideOf(tokens[i]);
      used[i] = true;
      i--;
    } else if (sideOf(tokens[i]) && i > 0 && ENTRY_CODE.test(tokens[i - 1])) {
      // "Greenhill MR Aff v Brentwood RY Neg"
      leftSide = sideOf(tokens[i]);
      used[i] = true;
      i--;
    }
    const leftEnd = i;
    while (i >= 0) {
      const token = tokens[i];
      if (i < leftEnd && (isStop(token) || sideOf(token))) break;
      if (i === leftEnd && (token === SEP || YEAR_TOKEN.test(token))) break;
      i--;
    }
    let leftStart = i + 1;
    // "Aff Strake Jesuit BE vs. …": a side word just before the team.
    if (i >= 0 && sideOf(tokens[i]) && !leftSide) {
      leftSide = sideOf(tokens[i]);
      used[i] = true;
    }
    // "2020 UNLV Damien ND (Aff) v …": a tournament run onto the team.
    if (i >= 0 && YEAR_TOKEN.test(tokens[i])) {
      const words = tokens.slice(leftStart, leftEnd + 1);
      const skip = leadingTournamentWords(words);
      if (skip > 0 && words.length - skip >= 2) leftStart += skip;
    }

    // Right team: walk forward from the "vs".
    let rightSide: "aff" | "neg" | null = null;
    let j = vs + 1;
    if (sideOf(tokens[j])) {
      rightSide = sideOf(tokens[j]);
      used[j] = true;
      j++;
    }
    const rightStart = j;
    while (j < tokens.length) {
      const token = tokens[j];
      if (sideOf(token)) {
        if (!rightSide) rightSide = sideOf(token);
        used[j] = true;
        break;
      }
      if (j > rightStart && isStop(token)) break;
      if (token === SEP) break;
      j++;
      if (j - 1 > rightStart && ENTRY_CODE.test(token)) {
        // The code ends the team, unless a few more words end in a code of
        // their own before the next break: "Stanford OHS AY",
        // "Central HS Springfield LM 2022" (but not "Seven Lakes LM TOC Octos").
        let k = j;
        while (k < tokens.length && k - j < 3 && !isStop(tokens[k]) && !sideOf(tokens[k])) k++;
        const more = tokens.slice(j, k);
        if (
          more.length > 0 &&
          ENTRY_CODE.test(more[more.length - 1]) &&
          leadingTournamentWords(more) === 0 &&
          (k === tokens.length || isStop(tokens[k]) || sideOf(tokens[k]))
        ) {
          j = k;
        }
        // A side word right after the code belongs to the team.
        if (j < tokens.length && sideOf(tokens[j])) {
          if (!rightSide) rightSide = sideOf(tokens[j]);
          used[j] = true;
        }
        break;
      }
    }
    const rightEnd = j - 1;

    const left = leftStart <= leftEnd ? tidyTeam(tokens.slice(leftStart, leftEnd + 1)) : null;
    const right = rightStart <= rightEnd ? tidyTeam(tokens.slice(rightStart, rightEnd + 1)) : null;
    if (left && right) {
      for (let k = leftStart; k <= leftEnd; k++) used[k] = true;
      for (let k = rightStart; k <= rightEnd; k++) used[k] = true;
      sidesStated = !!(leftSide || rightSide);
      const leftIsNeg = leftSide === "neg" || (!leftSide && rightSide === "aff");
      affTeam = leftIsNeg ? right : left;
      negTeam = leftIsNeg ? left : right;
    } else {
      used.fill(false);
    }
  }

  const rest = tokens
    .map((token, index) => (used[index] || token === AFF || token === NEG ? SEP : token))
    .join(" ");
  const { tournament, roundLevel } = readEventPhrase(rest);

  return { tournament, roundLevel, affTeam, negTeam, sidesStated, year };
}

/** Format names, removed from a tournament name. */
const FORMAT_PHRASE =
  /\b(?:(?:varsity|novice|jv)\s+)?(?:lincoln[\s-]*douglas|public\s+forum|cross[\s-]*ex(?:amination)?|world\s+schools|parliamentary|parli|congress|j?v?ld|n?ld|v?pfd?|cx|policy)(?:\s+debate)?\b/gi;

/** Words that are never part of a tournament name. */
const FILLER_PHRASE =
  /\b(?:round\s+video(?:\s+recording)?|video|recording|full\s+round|debate\s+round|with\s+rfd|rfd|vid|partial|flight\s+\d+|room\s+\d+|audio\s+only|elim(?:ination)?s?|prelim(?:inary)?s?|open|varsity|division)\b/gi;

/**
 * The tournament and round named in a phrase with no teams in it — what a
 * title leaves once its teams are taken out, or a description's
 * "Event: 2024 Glenbrooks Round 3" line.
 *
 * @param phrase - Text; "¦" or "|" / " - " / ":" separate its parts.
 */
export function readEventPhrase(phrase: string): { tournament: string | null; roundLevel: string | null } {
  let text = ` ${phrase.replace(/\s*(?:\||--+|\s-\s|:\s)\s*/g, ` ${SEP} `)} `;

  const roundRobin = ROUND_ROBIN.test(text);
  const practice = /\bpractice\s+round\b/i.test(text);
  text = text.replace(/\bpractice\s+round\b/gi, SEP).replace(/\bround[\s-]*robin\b|\bRR\b/gi, SEP);

  let roundLevel: string | null = null;
  for (const [pattern, level] of ROUND_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    roundLevel = typeof level === "string" ? level : level(match);
    text = text.replace(new RegExp(pattern.source, "gi"), SEP);
    break;
  }
  // Leftover round words ("Round X", "Round ?") and the other levels' words.
  text = text
    .replace(/\bround\s*(?:[ivx]+|\?|x)?(?=\s|$)/gi, SEP)
    .replace(new RegExp(ROUND_PATTERNS.map(([p]) => p.source).join("|"), "gi"), SEP)
    .replace(/\bspeech\s+(?:and|&)\s+debate(?:\s+tournament)?\b/gi, " ")
    .replace(FORMAT_PHRASE, " ")
    .replace(FILLER_PHRASE, " ")
    .replace(/\bdebates?\b/gi, " ")
    .replace(/\b(?:19[5-9]\d|20[0-4]\d)(?:\s*-\s*(?:19|20)?\d{2})?\b|'\d{2}\b/g, " ")
    .replace(/#\S+/g, " ")
    .replace(/\s@\s/g, " at ")
    .replace(/\//g, " ");

  const segments = text
    .split(new RegExp(`\\s*${SEP}\\s*`))
    .map((segment) => segment.replace(/^[\s,.;:&-]+|[\s,.;:&-]+$/g, "").replace(/\s+/g, " ").trim())
    .filter((segment) => /[A-Za-z]{2,}/.test(segment) && !/\btopic\b/i.test(segment) && !/^(?:debate|the|and|of|at)$/i.test(segment));

  let tournament = segments[0] ? canonicalTournament(segments[0]) : null;
  if (tournament && roundRobin && !/round robin$/i.test(tournament)) tournament = `${tournament} Round Robin`;
  if (tournament && practice) tournament = `${tournament} Practice Round`;
  if (roundRobin) roundLevel = "Round Robin";

  return { tournament, roundLevel };
}
