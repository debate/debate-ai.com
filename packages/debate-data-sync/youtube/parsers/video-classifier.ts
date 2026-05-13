/**
 * Determines whether a video is a debate round or a lecture
 */

export function isRound(title: string, description: string): boolean {
  // Strong indicators it's NOT a round (check first)
  if (/\b(practice|demo|demonstration)\b/i.test(title)) return false;
  if (/\b(lecture|webinar|tutorial|how to|guide|tip|advice|discusses|discussing|instructional)\b/i.test(title))
    return false;
  if (/\b(academy|class|lesson|workshop|seminar)\b/i.test(title)) return false;

  // Titles that start with action verbs indicating instructional content
  if (/^(giving|teaching|learning|understanding|mastering|explaining|how|weighing)\b/i.test(title)) return false;

  // Instructional series patterns (Part 1, 101, etc.)
  if (/\b(part\s*\d+|101|102|201)\b/i.test(title)) return false;

  // Analysis/review videos (not actual rounds)
  if (/\b(analysis|review|breakdown|recap)\b/i.test(title)) return false;

  // Check description for instructional language
  if (/\b(instructional|tutorial)\b/i.test(description)) return false;
  if (/\bthis video (is|teaches|explains|demonstrates|shows how|discusses)\b/i.test(description)) return false;
  if (/\bthis is an analysis\b/i.test(description)) return false;

  // Must have team indicators (vs, v, or " -- ")
  const hasTeamIndicator =
    /\bvs\.?\b/i.test(title) ||
    /\s--\s.*\s+v\s+/i.test(title) || // Pattern: "Tournament -- Team1 v Team2"
    /:\s*.+\s+vs?\.?\s+.+$/i.test(title); // Pattern: "Tournament: Team1 vs Team2"

  // Round level indicators
  const hasRoundLevel =
    /\b(finals?|semifinals?|semis|quarterfinals?|quarters|octafinals?|octas|doubles?|triples?)\b/i.test(
      title,
    ) ||
    /\bround\s*\d+\b/i.test(title) ||
    /\br\d+\b/i.test(title);

  // A video is a round if it has both teams AND a round level
  if (hasTeamIndicator && hasRoundLevel) return true;

  // OR if it has teams and a decision in the description
  if (hasTeamIndicator) {
    if (/\b(aff(?:irmative)?|neg(?:ative)?)\s+win/i.test(description))
      return true;
    if (/\d+-\d+\s+for\s+the\s+(affirmative|negative)/i.test(description))
      return true;
  }

  // Check description for strong round indicators (speech times)
  const hasSpeechTimestamps = /\b(1ac|1nc|2ac|2nc|1nr|1ar|2nr|2ar)\b/i.test(description);
  if (hasSpeechTimestamps && hasTeamIndicator) return true;

  return false; // default to lecture if unclear
}
