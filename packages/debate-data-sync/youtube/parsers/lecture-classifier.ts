/**
 * Classifier for categorizing lecture videos into educational topics
 */

export function classifyLecture(title: string, description: string): string {
  const t = title.toLowerCase();
  const d = (description || "").toLowerCase();
  const both = t + " " + d;

  // Topic Lectures
  if (
    /topic\s*(analysis|analyses|lecture|breakdown|overview|discussion|webinar)/i.test(
      title,
    )
  )
    return "Topic Lectures";
  if (/\btopic\b/i.test(title) && /\b(prep|strategy|file|guide)\b/i.test(title))
    return "Topic Lectures";

  // Novice & Introductory
  if (
    /\b(intro to|introduction|beginner|novice|basics|abc.?s of|getting started|what is)\b/i.test(
      title,
    )
  )
    return "Novice & Introductory";

  // Affirmative Strategy
  if (
    /\b(1ac|2ac|1ar|aff strategy|aff case|affirmative|case writing|contention|constructing a contention|conceptualizing aff)\b/i.test(
      both,
    )
  )
    return "Affirmative Strategy";

  // Negative Strategy
  if (
    /\b(neg strategy|negative|2nr|1nr|2nc|1nc|neg prep|block writing|case neg)\b/i.test(
      both,
    )
  )
    return "Negative Strategy";

  // Kritik / Critical Theory
  if (
    /\b(kritik|k\b|critical theory|afropessimism|cap k|settler colonial|baudrillard|security k|queer theory|deleuze|foucault)\b/i.test(
      both,
    )
  )
    return "Kritik / Critical Theory";

  // Counterplans & Theory
  if (
    /\b(counterplan|cp\b|conditionality|theory|competition|solvency advocate|perm)\b/i.test(
      both,
    )
  )
    return "Counterplans & Theory";

  // Topicality & Framework
  if (
    /\b(topicality|framework|t vs|fairness|fiat|plan text|reasonability)\b/i.test(
      both,
    )
  )
    return "Topicality & Framework";

  // Disadvantages
  if (
    /\b(disadvantage|disad|politics da|da\b|risk analysis|elections da|economy da|link comparison)\b/i.test(
      both,
    )
  )
    return "Disadvantages";

  // Impact Calculus & Evidence
  if (
    /\b(impact|magnitude|probability|timeframe|evidence comparison|risk assessment|weighing|meta.?weighing)\b/i.test(
      both,
    )
  )
    return "Impact Calculus & Evidence";

  // Speaking & Delivery
  if (
    /\b(speaking|delivery|speaker|vocal|roadmap|cx technique|persuasi|presentation|crossfire|cross.?exam)\b/i.test(
      both,
    )
  )
    return "Speaking & Delivery";

  // Research & Flowing
  if (
    /\b(research|flowing|flow|card cutting|verbatim|paperless|evidence)\b/i.test(
      both,
    )
  )
    return "Research & Flowing";

  // Public Forum
  if (
    /\b(public forum|pf\b|summary speech|final focus|rebuttal strategy)\b/i.test(
      both,
    )
  )
    return "Public Forum";

  // Demo Debates
  if (/\b(demo|demonstration|sample|example|model)\b/i.test(title))
    return "Demo Debates";

  // Judge & Tournament Skills
  if (
    /\b(judge|tournament|prefs|post.?round|mental|preparing for tournament)\b/i.test(
      both,
    )
  )
    return "Judge & Tournament Skills";

  // Philosophy & IR Theory
  if (
    /\b(philosophy|kant|ir theory|political economy|critical ir|environmental theory)\b/i.test(
      both,
    )
  )
    return "Philosophy & IR Theory";

  // Camp & Coaching Advice
  if (
    /\b(camp|institute|lab|workshop|seminar|coaching|team leadership)\b/i.test(
      both,
    )
  )
    return "Camp & Coaching Advice";

  // Documentaries & Culture
  if (
    /\b(documentary|anti.?blackness|panel|community|humor|culture|interview|podcast|commentary|recap|reaction)\b/i.test(
      both,
    )
  )
    return "Documentaries & Culture";

  // Fallback: check for "DebateDrills Academy" pattern
  if (/DebateDrills Academy/i.test(title)) return "Affirmative Strategy";

  // Strategy catch-all
  if (
    /\b(strategy|strat|tactic|technique|approach|conceptualiz|turning the round)\b/i.test(
      title,
    )
  )
    return "Affirmative Strategy";

  return "Novice & Introductory";
}
