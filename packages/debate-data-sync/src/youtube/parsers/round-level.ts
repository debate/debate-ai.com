export type StandardRoundLevel =
  | `R${number}`
  | "TRIPLES"
  | "DOUBLES"
  | "OCTOS"
  | "QUARTERS"
  | "SEMIS"
  | "FINALS"
  | "RUNOFFS"
  | "UNKNOWN";

export type RoundParseConfidence =
  | "exact"
  | "normalized"
  | "inferred"
  | "unknown";

export type ParsedRoundLevel = {
  raw: string;
  normalized: string;
  level: StandardRoundLevel;
  confidence: RoundParseConfidence;
};

const ORDINAL_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
};

const ROMAN_NUMERALS: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  xi: 11,
  xii: 12,
  xiii: 13,
  xiv: 14,
  xv: 15,
  xvi: 16,
  xvii: 17,
  xviii: 18,
  xix: 19,
  xx: 20,
};

function normalizeText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u2010-\u2015]/g, "-") // Unicode dashes → hyphen
    .replace(/[._/]/g, " ")
    .replace(/([a-z])(\d)/gi, "$1 $2") // R6 → R 6
    .replace(/(\d)([a-z])/gi, "$1 $2") // 6th → 6 th
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toRound(number: number): StandardRoundLevel {
  return `R${number}`;
}

function validRoundNumber(number: number): boolean {
  return Number.isInteger(number) && number >= 1 && number <= 99;
}

function result(
  raw: string,
  normalized: string,
  level: StandardRoundLevel,
  confidence: RoundParseConfidence,
): ParsedRoundLevel {
  return { raw, normalized, level, confidence };
}

/**
 * Standardizes raw tournament round labels.
 *
 * Supports examples such as:
 *
 * R1, R6, RD 4, Round 3, Round 01
 * Open Round 8, Prelim Round 4, Preliminary Round 2
 * Round Second, Round the First, Round Eighth
 * Round 7th, Round 2nd
 * Round IV, R VI
 * 3, 06
 * Triple Octos, Doubles, Double Octofinals
 * Octos, Octas, Octofinals, Octo Finals
 * Quarters, Quarterfinals, QF
 * Semis, Semifinals, SF
 * Final, Finals, Grand Finals, Championship
 * Final Round - Wake Forest(A)
 * Runoff, Runoffs
 */
export function parseRoundLevel(
  value: string | null | undefined,
): ParsedRoundLevel {
  const raw = value?.trim() ?? "";
  const normalized = normalizeText(raw);

  if (!normalized) {
    return result(raw, normalized, "UNKNOWN", "unknown");
  }

  /*
   * Named elimination rounds must be parsed in order of specificity.
   *
   * Compound prefixes (triple, double, octo, quarter, semi) must be matched
   * BEFORE bare "finals" so that "Semi-Finals", "Quarter Finals", and
   * "Octo Finals" are not prematurely matched as FINALS.
   */

  // Triple octofinals. Must come before generic "octos".
  if (
    /\b(?:triples?|triple[\s-]?(?:octos?|octas?|octofinals?|octa[\s-]?finals?))\b/.test(
      normalized,
    )
  ) {
    const exact =
      /^(?:triples?|triple[\s-]?(?:octos?|octas?|octofinals?|octa[\s-]?finals?))$/.test(
        normalized,
      );

    return result(raw, normalized, "TRIPLES", exact ? "exact" : "normalized");
  }

  // Double octofinals. Must come before generic "octos".
  if (
    /\b(?:doubles?|double[\s-]?(?:octos?|octas?|octofinals?|octa[\s-]?finals?))\b/.test(
      normalized,
    )
  ) {
    const exact =
      /^(?:doubles?|double[\s-]?(?:octos?|octas?|octofinals?|octa[\s-]?finals?))$/.test(
        normalized,
      );

    return result(raw, normalized, "DOUBLES", exact ? "exact" : "normalized");
  }

  // Octofinals
  if (
    /\b(?:octos?|octas?|octo[\s-]?finals?|octa[\s-]?finals?|octofinals?)\b/.test(
      normalized,
    )
  ) {
    const exact =
      /^(?:octos?|octas?|octo[\s-]?finals?|octa[\s-]?finals?|octofinals?)$/.test(
        normalized,
      );

    return result(raw, normalized, "OCTOS", exact ? "exact" : "normalized");
  }

  // Quarterfinals
  if (
    /\b(?:quarters?|quarter[\s-]?finals?|quarterfinals?|qf)\b/.test(
      normalized,
    )
  ) {
    const exact = /^(?:quarters?|quarter[\s-]?finals?|quarterfinals?)$/.test(
      normalized,
    );

    return result(
      raw,
      normalized,
      "QUARTERS",
      exact ? "exact" : "normalized",
    );
  }

  // Semifinals (require 'semis', 'semi-finals', 'semifinals', or 'sf', not bare 'semi')
  if (
    /\b(?:semis|semi[\s-]?finals?|semifinals?|sf)\b/.test(normalized)
  ) {
    const exact = /^(?:semis|semi[\s-]?finals?|semifinals?)$/.test(
      normalized,
    );

    return result(raw, normalized, "SEMIS", exact ? "exact" : "normalized");
  }

  // Runoffs / qualifying rounds commonly used at TOC.
  if (
    /\brun[\s-]?offs?\b/.test(normalized) ||
    /\bqualifying\s+round\b/.test(normalized)
  ) {
    const exact = /^run[\s-]?offs?$/.test(normalized);

    return result(raw, normalized, "RUNOFFS", exact ? "exact" : "normalized");
  }

  // Finals
  if (
    /\b(?:grand\s+)?finals?\b/.test(normalized) ||
    /\b(?:championship|championship\s+round)\b/.test(normalized) ||
    /\b(?:title\s+round)\b/.test(normalized) ||
    /\b1st\s+place\b/.test(normalized)
  ) {
    const exact = /^(?:grand\s+)?finals?$/.test(normalized);

    return result(raw, normalized, "FINALS", exact ? "exact" : "normalized");
  }

  /*
   * Numeric forms:
   *
   * R1
   * R 1
   * Rd 1
   * Round 1
   * Round #1
   * Round 01
   * Open Round 8
   * Prelim Round 4
   * Preliminary Round 4
   * Elim Round 3
   */
  const numericRoundMatch = normalized.match(
    /\b(?:(?:open|prelim(?:inary)?|elim(?:ination)?)\s+)?(?:r|rd|round)\s*#?\s*0*(\d{1,3})(?:st|nd|rd|th)?\b/i,
  );

  if (numericRoundMatch) {
    const roundNumber = Number(numericRoundMatch[1]);

    if (validRoundNumber(roundNumber)) {
      const exact =
        /^(?:r|rd|round)\s*#?\s*0*\d+(?:st|nd|rd|th)?$/.test(normalized);

      return result(
        raw,
        normalized,
        toRound(roundNumber),
        exact ? "exact" : "normalized",
      );
    }
  }

  /*
   * Spelled ordinal forms:
   *
   * Round First
   * Round the First
   * Round Second
   * Round Eighth
   * Open Round Sixth
   */
  const wordRoundMatch = normalized.match(
    /\b(?:(?:open|prelim(?:inary)?|elim(?:ination)?)\s+)?round\s+(?:the\s+)?([a-z]+)\b/i,
  );

  if (wordRoundMatch) {
    const roundNumber = ORDINAL_WORDS[wordRoundMatch[1].toLowerCase()];

    if (roundNumber) {
      return result(raw, normalized, toRound(roundNumber), "normalized");
    }
  }

  /*
   * Roman numeral forms:
   *
   * R IV
   * Round VI
   * Open Round VIII
   */
  const romanRoundMatch = normalized.match(
    /\b(?:(?:open|prelim(?:inary)?|elim(?:ination)?)\s+)?(?:r|rd|round)\s+([ivxlcdm]+)\b/i,
  );

  if (romanRoundMatch) {
    const roman = romanRoundMatch[1].toLowerCase();
    const roundNumber = ROMAN_NUMERALS[roman];

    if (roundNumber && validRoundNumber(roundNumber)) {
      return result(raw, normalized, toRound(roundNumber), "normalized");
    }
  }

  /*
   * Bare numeric labels appear in your import:
   *
   * NDT / 3
   * Fullerton / 6
   *
   * Because a number without field context is ambiguous, it is marked
   * "inferred" rather than exact or normalized.
   */
  const bareNumberMatch = normalized.match(/^0*(\d{1,2})$/);

  if (bareNumberMatch) {
    const roundNumber = Number(bareNumberMatch[1]);

    if (validRoundNumber(roundNumber)) {
      return result(
        raw,
        normalized,
        toRound(roundNumber),
        "inferred",
      );
    }
  }

  return result(raw, normalized, "UNKNOWN", "unknown");
}

export function standardizeRoundLevel(
  value: string | null | undefined,
): StandardRoundLevel {
  return parseRoundLevel(value).level;
}

export function formatRoundLevel(level: StandardRoundLevel): string {
  if (level.startsWith("R")) {
    return `Round ${level.slice(1)}`;
  }

  const labels: Record<Exclude<StandardRoundLevel, `R${number}`>, string> = {
    TRIPLES: "Triple Octofinals",
    DOUBLES: "Double Octofinals",
    OCTOS: "Octofinals",
    QUARTERS: "Quarterfinals",
    SEMIS: "Semifinals",
    FINALS: "Finals",
    RUNOFFS: "Runoffs",
    UNKNOWN: "Unknown round",
  };

  return labels[level as Exclude<StandardRoundLevel, `R${number}`>];
}

export function getRoundSortKey(level: StandardRoundLevel): number {
  if (level.startsWith("R")) {
    return Number(level.slice(1));
  }

  const sortKeys: Record<Exclude<StandardRoundLevel, `R${number}`>, number> = {
    UNKNOWN: -1,

    // Elimination rounds come after prelim rounds.
    TRIPLES: 100,
    DOUBLES: 110,
    OCTOS: 120,
    QUARTERS: 130,
    SEMIS: 140,
    FINALS: 150,

    // TOC runoffs happen before the main elimination bracket in practice,
    // but keeping them distinct avoids pretending they are Double Octos.
    RUNOFFS: 160,
  };

  return sortKeys[level as Exclude<StandardRoundLevel, `R${number}`>];
}
