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
  "Miscellaneous",
] as const;

export type LectureCategory = (typeof LECTURE_CATEGORIES)[number];

/**
 * The shelf for lectures that fit no other category: the classifier's
 * fallback, the model's answer when nothing fits, and where a published
 * lecture with no category (or one this app doesn't know) is counted.
 */
export const MISCELLANEOUS_CATEGORY = "Miscellaneous" satisfies LectureCategory;

/**
 * Category labels still found on stored lectures that the classifier no longer
 * produces and a picker no longer offers: earlier names of today's categories
 * ("Critical Theory", "Topic Analysis"), the two topic series, round analyses
 * and awards. They are known shelves, so a lecture filed under one is not
 * "unsorted".
 */
export const LEGACY_LECTURE_CATEGORIES = [
  "Critical Theory",
  "Judge Skills",
  "Camp & Coaching",
  "Topic Analysis",
  "PF & LD Topic Analysis",
  "Policy Topic Lectures",
  "Round Analysis",
  "Awards",
] as const;

/**
 * How the model should file a lecture, shared by the queue's auto-detect and
 * the library autofill prompts so the two never drift apart.
 */
export const LECTURE_CATEGORY_GUIDANCE = `Category notes: "Congress" is for lectures about Congressional Debate (student congress): legislation and bill writing, presiding officer, precedence and recency, chamber speeches — not for a lecture about the US Congress as a policy topic. "Open Super Debates" is for anything from the Super Debate channel or titled "Super Debate". "Miscellaneous" is the fallback: use it when no other category clearly fits, rather than guessing.`;

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
 * The lecture category for Congressional Debate lectures, the "Congress" shelf
 * at `/videos/congress`. Debate *rounds* of style 9 (Congress) sit on the same
 * shelf by style; this category is what a *lecture* (style null) is filed under.
 */
export const CONGRESS_LECTURE_CATEGORY = "Congress" satisfies LectureCategory;

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
 * Phrases that name Congressional Debate (student congress) on their own, in a
 * title, description or channel name. Deliberately narrow: a lecture about the
 * US Congress as a policy topic ("Congress should reform the filibuster")
 * matches none of them.
 */
const CONGRESS_DEBATE_PHRASES: RegExp[] = [
  /\bcongressional\s+debate\b/i,
  /\bstudent\s+congress\b/i,
  /\b(?:hs|high\s+school|nsda|ncfl|tfa)\s+congress\b/i,
  /\bcongress\s+(?:debate|speech(?:es)?|rounds?|sessions?|chambers?|legislation|bills?|docket|tips|prelims?|finals?|semis?|rules|basics|101|po|presiding|coaching|event|workshop|camp)\b/i,
  /\b(?:presiding\s+officer|precedence\s+and\s+recency|points?\s+of\s+(?:order|personal\s+privilege)|authorship\s+speech|sponsorship\s+speech)\b/i,
];

/** The channel names that only film Congressional Debate, e.g. "Student Congress Coach". */
const CONGRESS_DEBATE_CHANNEL = /\bstudent\s+congress\b|\bcongressional\s+debate\b/i;

/**
 * Words that mark a lecture as Congressional Debate once "congress" is also
 * said: the specific ones (a docket, precedence and recency, a presiding
 * officer...) and the general ones (a bill, legislation) that a civics lecture
 * uses too, which therefore count only alongside a specific one.
 */
const CONGRESS_SPECIFIC_TERMS: RegExp[] = [
  /\bdockets?\b/i,
  /\bpresiding\s+officer\b/i,
  /\bprecedence\b/i,
  /\brecency\b/i,
  /\b(?:sponsorship|authorship)\b/i,
  /\bpoints?\s+of\s+order\b/i,
  /\bprevious\s+question\b/i,
  /\bchamber\b/i,
  /\bparliamentarian\b/i,
];
const CONGRESS_GENERAL_TERMS: RegExp[] = [/\bbills?\b/i, /\blegislation\b/i, /\bamendments?\b/i];

/**
 * Whether a lecture is about Congressional Debate (student congress), read
 * conservatively from its title, description and channel:
 *
 * - a phrase that names the event outright ("Congressional Debate",
 *   "Student Congress", "Congress speech", "presiding officer", "precedence
 *   and recency"...) in the title or description, or a channel named for it;
 * - or "congress" together with two of its specific terms, or one specific
 *   term and a general one (a bill, legislation), e.g. a description reading
 *   "how to write a bill, sponsor it and win the docket in Congress".
 *
 * A US Congress policy-topic lecture ("Congress and the filibuster", "How a
 * bill becomes law") does not match. "American Congressional" (ACC) lectures
 * are filed by the ACC rule ahead of this one.
 */
export function isCongressDebateLecture(
  title: string | null | undefined,
  description?: string | null,
  channel?: string | null,
): boolean {
  if (channel && CONGRESS_DEBATE_CHANNEL.test(channel)) return true;
  const text = `${title ?? ""}\n${description ?? ""}`;
  if (CONGRESS_DEBATE_PHRASES.some((phrase) => phrase.test(text))) return true;
  if (!/\bcongress(?:ional)?\b/i.test(text)) return false;
  const specific = CONGRESS_SPECIFIC_TERMS.filter((term) => term.test(text)).length;
  const general = CONGRESS_GENERAL_TERMS.filter((term) => term.test(text)).length;
  return specific >= 2 || (specific >= 1 && general >= 1);
}

/**
 * The shelf a lecture's title, description and channel decide by rule alone:
 * {@link forcedLectureCategory} (Super Debate, NSDA), else "Congress" for a
 * Congressional Debate lecture ({@link isCongressDebateLecture}), else `null`
 * when the keyword classifier or the model decides.
 */
export function ruleLectureCategory(
  title: string | null | undefined,
  description?: string | null,
  channel?: string | null,
): LectureCategory | null {
  const forced = forcedLectureCategory(title, channel);
  if (forced) return forced;
  return isCongressDebateLecture(title, description, channel) ? CONGRESS_LECTURE_CATEGORY : null;
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
  if (isCongressDebateLecture(title, description, channel)) return "Congress";
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

  return MISCELLANEOUS_CATEGORY;
}
