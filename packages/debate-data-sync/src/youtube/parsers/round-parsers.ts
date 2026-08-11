/**
 * Parsers for extracting metadata from debate round titles and descriptions
 */

export function parseDebateStyle(title: string, channel?: string): number {
  const t = title.toLowerCase();
  // Check for explicit format in title first
  if (/\b(ld|lincoln.?douglas)\b/i.test(t)) return 3;
  if (/\b(pf|public\s*forum)\b/i.test(t)) return 2;
  if (/\b(cx|policy|cross.?x)\b/i.test(t)) return 1;
  if (/\b(college|ndt|ceda)\b/i.test(t)) return 4;

  // Default by channel
  if (channel && /debatedrills/i.test(channel)) return 2; // DebateDrills is primarily PF

  return 1; // default to Policy for other channels
}

export function parseRoundLevel(title: string): string | null {
  // Round Robin (special prelim format)
  if (/\bRound Robin\b/i.test(title)) return "Round Robin";

  // Elim rounds - capture exact text
  const elimMatch = title.match(
    /\b(Finals?|Semifinals?|Semis|Quarterfinals?|Quarters|Octafinals?|Octas|Doubles?|Triples?|Runoffs?)\b/i,
  );
  if (elimMatch) {
    // Normalize to standard names
    const level = elimMatch[1].toLowerCase();
    if (level === "semis" || level === "semifinals" || level === "semifinal")
      return "Semifinals";
    if (
      level === "quarters" ||
      level === "quarterfinals" ||
      level === "quarterfinal"
    )
      return "Quarterfinals";
    if (level === "octas" || level === "octafinals" || level === "octafinal")
      return "Octafinals";
    if (level === "finals" || level === "final") return "Finals";
    if (level === "doubles" || level === "double") return "Doubles";
    if (level === "triples" || level === "triple") return "Triples";
    if (level === "runoffs" || level === "runoff") return "Runoffs";
    return elimMatch[1]; // fallback to original
  }
  // Prelim rounds
  const roundMatch = title.match(/\bR(?:ound\s*)?(\d+)\b/i);
  if (roundMatch) return `R${roundMatch[1]}`;
  return null;
}

export function parseTournament(title: string): string | null {
  // Helper function to normalize tournament names
  const normalizeTournament = (name: string): string => {
    let normalized = name.trim();

    // Normalize "Tournament of Champions" to "TOC"
    normalized = normalized.replace(/\bTournament of Champions\b/i, "TOC");

    // Other common normalizations
    normalized = normalized.replace(/\bNational Debate Tournament\b/i, "NDT");

    return normalized;
  };

  // Pattern 1: "YEAR Tournament Name Format Round: Teams" (with colon)
  // Example: "2024 Tournament of Champions LD R4: Horace Greeley SG vs OCSA IL"
  // Example: "2024 Tournament of Champions LD Doubles: Horace Greeley SG vs Monta Vista EY"
  const pattern1 = title.match(
    /^(\d{4}\s+.+?)\s+(?:LD|PF|CX|Policy|Public Forum|Lincoln[- ]Douglas)\s+(?:Finals?|Semifinals?|Semis|Quarterfinals?|Quarters|Octafinals?|Octas|Doubles?|Triples?|R\d+|Round\s*\d+)\s*:/i,
  );
  if (pattern1) {
    return normalizeTournament(pattern1[1]);
  }

  // Pattern 2: "YEAR Tournament Name Round/Finals Team1 (Aff) vs Team2 (Neg)"
  // Example: "2019 Apple Valley Quarterfinals Strake WH (Aff) vs Santa Monica RE (Neg)"
  // Extract everything before the round level + first team
  const pattern2 = title.match(
    /^(\d{4}\s+[A-Z][^\d(]+?)\s+(?:Finals?|Semifinals?|Semis|Quarterfinals?|Quarters|Octafinals?|Octas|Doubles?|Triples?|R\d+|Round\s*\d+)\s+[A-Z]/i,
  );
  if (pattern2) {
    return normalizeTournament(pattern2[1]);
  }

  // Pattern 3: "YEAR Tournament Name Round/Finals -- Teams" or with colon
  // Example: "2012 NDT Finals -- Northwestern BK v Georgetown AM"
  // Example: "2024 Tournament of Champions Doubles: Team1 vs Team2"
  const pattern3 = title.match(
    /^(\d{4}\s+[A-Z][^\-:]+?)\s+(?:Finals?|Semifinals?|Semis|Quarterfinals?|Quarters|Octafinals?|Octas|Doubles?|Triples?|R\d+|Round\s*\d+)\s*(?:--|:)/i,
  );
  if (pattern3) {
    return normalizeTournament(pattern3[1]);
  }

  // Pattern 3a: "YEAR Tournament Name Format Round -- Teams"
  // Example: "2003 TOC LD Semis -- CPS AB v Westminster LR"
  const pattern3a = title.match(
    /^(\d{4}\s+[A-Z][^\-:]+?)\s+(?:LD|PF|CX|Policy|Public Forum|Lincoln[- ]Douglas)\s+(?:Finals?|Semifinals?|Semis|Quarterfinals?|Quarters|Doubles?|Triples?|R\d+)\s*(?:--|:)/i,
  );
  if (pattern3a) {
    return normalizeTournament(pattern3a[1]);
  }

  // Pattern 4: "Tournament Name YEAR Round -- Teams"
  // Example: "Wake Forest 2009 Quarters -- MSU LW v UTD BR"
  const pattern4 = title.match(
    /^([A-Z][^\d]+?)\s*(\d{4})\s+(?:Finals?|Semifinals?|Quarters|Octas|Doubles?|Triples?|R\d+)\s*(?:--|:)/i,
  );
  if (pattern4) {
    return normalizeTournament(`${pattern4[2]} ${pattern4[1].trim()}`);
  }

  // Pattern 5: Everything before " -- " or " : " if it contains a year
  const pattern5 = title.match(/^(.+?)\s*(?:--|:)/);
  if (pattern5 && /\d{4}/.test(pattern5[1])) {
    // Remove round level and format from end
    let tourney = pattern5[1].trim();
    tourney = tourney
      .replace(
        /\s+(?:Finals?|Semifinals?|Semis|Quarterfinals?|Quarters|Octafinals?|Octas|Doubles?|Triples?|R\d+|Round\s*\d+)$/i,
        "",
      )
      .trim();
    tourney = tourney.replace(/\s+(?:LD|PF|CX|Policy)$/i, "").trim();
    return normalizeTournament(tourney);
  }

  return null;
}

export function parseTeams(title: string): {
  aff: string | null;
  neg: string | null;
} {
  // Pattern 1: "Team1 (Aff) vs. Team2 (Neg)" - capture just school + 2-letter code
  // Example: "2022 Greenhill LD Round 6 Saratoga AG (Aff) vs Oxford VM (Neg)"
  // Look for word boundaries and capture minimal school name + code
  const pattern1 = title.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+[A-Z]{2})\s*\(Aff\)\s+vs\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+[A-Z]{2})\s*\(Neg\)/i);
  if (pattern1) {
    return { aff: pattern1[1].trim(), neg: pattern1[2].trim() };
  }

  // Pattern 2: " -- Team1 v Team2" (single letter v)
  const pattern2 = title.match(/--\s*(.+?)\s+v\s+(.+?)$/i);
  if (pattern2) {
    let aff = pattern2[1].trim();
    let neg = pattern2[2].trim();
    // Remove trailing text like "Round Analysis"
    neg = neg.replace(/\s+(Round\s+)?Analysis$/i, "").trim();
    return { aff, neg };
  }

  // Pattern 3: ": Team1 vs Team2" or ": Team1 vs. Team2"
  const pattern3 = title.match(/:\s*(.+?)\s+vs\.?\s+(.+?)$/i);
  if (pattern3) {
    let aff = pattern3[1].trim();
    let neg = pattern3[2].trim();
    // Remove side indicators like "(Aff)" or "(Neg)"
    aff = aff.replace(/\s*\(Aff\)$/i, "").trim();
    neg = neg.replace(/\s*\(Neg\).*$/i, "").trim();
    return { aff, neg };
  }

  // Pattern 4: "Team1 v. Team2"
  const pattern4 = title.match(/--\s*(.+?)\s+v\.\s+(.+?)$/i);
  if (pattern4) {
    let aff = pattern4[1].trim();
    let neg = pattern4[2].trim();
    neg = neg.replace(/\s+(Round\s+)?Analysis$/i, "").trim();
    return { aff, neg };
  }

  return { aff: null, neg: null };
}

export function parseWinner(description: string): boolean | null {
  if (!description) return null;

  // Check for explicit winner statements
  if (/for the affirmative/i.test(description)) return true;
  if (/for the negative/i.test(description)) return false;
  if (/aff(?:irmative)?\s+win/i.test(description)) return true;
  if (/neg(?:ative)?\s+win/i.test(description)) return false;

  // Check for decision format "X-Y for [team]"
  const decisionMatch = description.match(
    /(\d+)-(\d+)\s+for\s+(?:the\s+)?(affirmative|negative|aff|neg)/i,
  );
  if (decisionMatch) {
    const winner = decisionMatch[3].toLowerCase();
    return winner.startsWith("aff");
  }

  // Check for unanimous/split decision patterns
  if (/unanimous.*affirmative/i.test(description)) return true;
  if (/unanimous.*negative/i.test(description)) return false;

  return null;
}

export function parseJudgeDecision(description: string): string | null {
  if (!description) return null;

  // Pattern 1: "X-Y for the affirmative/negative (Judge1, Judge2, *Judge3)"
  const pattern1 = description.match(
    /(\d+-\d+)\s+for\s+(?:the\s+)?(?:affirmative|negative|aff|neg)\s*\(([^)]+)\)/i,
  );
  if (pattern1) {
    return `${pattern1[1]} (${pattern1[2].trim()})`;
  }

  // Pattern 2: "Unanimous decision" or "Split decision"
  if (/unanimous/i.test(description)) {
    const judgeMatch = description.match(/judge[s]?:\s*([^\n]+)/i);
    if (judgeMatch) {
      return `Unanimous (${judgeMatch[1].trim()})`;
    }
    return "Unanimous";
  }

  // Pattern 3: Just the vote split "X-Y"
  const voteMatch = description.match(/\b(\d+-\d+)\b/);
  if (voteMatch) {
    return voteMatch[1];
  }

  return null;
}
