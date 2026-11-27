/**
 * Classifier for categorizing lecture videos into educational topics
 */

/**
 * Every category {@link classifyLecture} can return, in the order a picker
 * should offer them — broadest first, then by side, then by skill.
 *
 * Exported so that anything letting a person *choose* a category (the
 * "miscategorized" video report, the admin metadata form) offers exactly the
 * set the classifier produces. A free-typed category silently creates a new
 * bucket in the library's category facets, which is how a single mistyped
 * label ends up as its own lecture shelf.
 */
export const LECTURE_CATEGORIES = [
  "Novice & Introductory",
  "Topic Lectures",
  "Affirmative Strategy",
  "Negative Strategy",
  "Critique / Critical Theory",
  "Counterplans & Theory",
  "Topicality & Framework",
  "Disadvantages",
  "Impact Calculus & Evidence",
  "Speaking & Delivery",
  "Research & Flowing",
  "Public Forum",
  "Demo Debates",
  "Judge & Tournament Skills",
  "Philosophy & IR Theory",
  "Camp & Coaching Advice",
  "Documentaries & Culture",
  "WSD",
  "ACC",
  "Parli",
  "Congress",
  "Speech",
  "NSDA Speech",
  "Open Super Debates",
] as const;

export type LectureCategory = (typeof LECTURE_CATEGORIES)[number];

/** Whether a label is one of the classifier's own categories. */
export function isLectureCategory(value: unknown): value is LectureCategory {
  return typeof value === "string" && (LECTURE_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Whether a title names parliamentary debate: "parli"/"parliamentary", or one
 * of its leagues and tournaments (NPDA, NPTE, APDA, NPDL, NPDI). Matched as
 * whole words so "parlay" or "parliament" (a British Parliament debate) stay
 * out.
 */
export const PARLI_TITLE = /\b(?:parli|parliamentary|NPDA|NPTE|APDA|NPDL|NPDI)\b/i;

/**
 * The collection a debate *round* is filed under on top of its style, or
 * `null` for none. Rounds otherwise carry no category, but the ACC (Atlantic
 * Coast Conference) tournament's rounds belong on the `/videos/acc` shelf
 * beside the ACC lectures, so a title naming "ACC Debate Tournament" files
 * the round there while it keeps its style. Parliamentary rounds (see
 * {@link PARLI_TITLE}) file under the Parli shelf, `/videos/parli`, the same
 * way, and congressional-debate rounds file under the Congress shelf,
 * `/videos/congress`.
 *
 * Open Super Debates ({@link isSuperDebateVideo}) win over every other
 * collection, rounds included.
 *
 * @param title - The video's title.
 * @param channel - The video's YouTube channel, when known.
 * @returns `"Open Super Debates"`, `"ACC"`, `"Congress"`, `"Parli"`, or `null` when the round belongs to no collection.
 */
export function classifyRoundCollection(title: string, channel?: string | null): LectureCategory | null {
  if (isSuperDebateVideo(title, channel)) return OPEN_SUPER_DEBATES_CATEGORY;
  if (/\bACC\s+Debate\s+Tournament\b/i.test(title)) return "ACC";
  if (/\bcongress\b/i.test(title)) return "Congress";
  if (PARLI_TITLE.test(title)) return "Parli";
  return null;
}

/**
 * The lecture category every video from the National Speech & Debate
 * Association's own YouTube channel is filed under, whatever its title says,
 * so the NSDA's lectures sit together as one shelf (`/lectures/nsda_speech`).
 */
export const NSDA_LECTURE_CATEGORY = "NSDA Speech" satisfies LectureCategory;

/**
 * Whether a YouTube channel is the NSDA's: its display name ("National Speech
 * & Debate Association") or its handle (`nsdaspeechanddebate`).
 */
export function isNsdaChannel(channel: string | null | undefined): boolean {
  if (!channel) return false;
  return /national\s+speech\s*(?:&|and)\s*debate\s+association|^@?nsda/i.test(channel.trim());
}

/**
 * The lecture category every Super Debate video is filed under: the "Open
 * Super Debates" shelf (`/lectures/open_super_debates`).
 */
export const OPEN_SUPER_DEBATES_CATEGORY = "Open Super Debates" satisfies LectureCategory;

/**
 * Matches "Super Debate", "Super Debater(s)", "SuperDebate", "Super-Debate"
 * and "super_debate" in any case, in a title or a channel name or handle
 * (`@SuperDebate`).
 */
export const SUPER_DEBATE_PATTERN = /super[\s_-]*debate/i;

/** Whether a YouTube channel is the Super Debate(r) channel. */
export function isSuperDebateChannel(channel: string | null | undefined): boolean {
  return !!channel && SUPER_DEBATE_PATTERN.test(channel);
}

/** Whether a title names Super Debate, e.g. "Chicago Super Debate Night 1 Recap". */
export function isSuperDebateTitle(title: string | null | undefined): boolean {
  return !!title && SUPER_DEBATE_PATTERN.test(title);
}

/**
 * Whether a video belongs on the Open Super Debates shelf: it comes from the
 * Super Debate channel, or its title says "Super Debate".
 */
export function isSuperDebateVideo(title: string | null | undefined, channel?: string | null): boolean {
  return isSuperDebateChannel(channel) || isSuperDebateTitle(title);
}

/**
 * The lecture category a channel forces on its lectures, or `null` when the
 * title decides: the NSDA channel ({@link isNsdaChannel}) and the Super
 * Debate channel ({@link isSuperDebateChannel}).
 */
export function lectureCategoryForChannel(channel: string | null | undefined): LectureCategory | null {
  if (isSuperDebateChannel(channel)) return OPEN_SUPER_DEBATES_CATEGORY;
  return isNsdaChannel(channel) ? NSDA_LECTURE_CATEGORY : null;
}

/**
 * The lecture category a video's channel or title forces on it, or `null`
 * when the keyword classifier decides. Super Debate videos (see
 * {@link isSuperDebateVideo}) and NSDA channel lectures are filed on their
 * own shelves whatever else the title or description says.
 */
export function forcedLectureCategory(title: string | null | undefined, channel?: string | null): LectureCategory | null {
  if (isSuperDebateTitle(title)) return OPEN_SUPER_DEBATES_CATEGORY;
  return lectureCategoryForChannel(channel);
}

/**
 * Files a lecture on a shelf from its title and description. When the title
 * or channel forces a shelf ({@link forcedLectureCategory}), that wins over
 * the keywords.
 */
export function classifyLecture(title: string, description: string, channel?: string | null): string {
  const forced = forcedLectureCategory(title, channel);
  if (forced) return forced;
  const t = title.toLowerCase();
  const d = (description || "").toLowerCase();
  const both = t + " " + d;

  // Format collections, decided by the title alone and ahead of every skill
  // shelf: a "WSD Rebuttals" lecture belongs with the World Schools videos,
  // not under Speaking & Delivery. Matched as whole words so "accent" or
  // "access" never lands in ACC.
  if (/\bWSD\b|\bworld\s*schools?\b/i.test(title)) return "WSD";
  if (/\bACC\b|\bamerican\s+congressional\b/i.test(title)) return "ACC";
  if (/\bcongress\b/i.test(title)) return "Congress";
  if (PARLI_TITLE.test(title)) return "Parli";

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

  // Critique / Critical Theory
  if (
    /\b(kritik|critique|k\b|critical theory|afropessimism|cap k|settler colonial|baudrillard|security k|queer theory|deleuze|foucault)\b/i.test(
      both,
    )
  )
    return "Critique / Critical Theory";

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
