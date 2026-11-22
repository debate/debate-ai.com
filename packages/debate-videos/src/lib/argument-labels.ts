/**
 * @fileoverview Turns a round's saved argument text (`videos.arg_1ac` /
 * `videos.arg_2nr`, e.g. `"NEW European Union, Cap K"`) into display parts:
 * each comma-separated argument gets its category (K, CP, DA, T, Theory, FW)
 * when one can be told from its name, and a `NEW` flag when the name carries
 * the word "new" (a new aff or a new 1NC/2NR position). The word itself is
 * taken out of the name so the UI can show it as a badge instead.
 *
 * Pure string work; `ArgumentLabels` in `components/videos/card` draws it.
 * @module lib/argument-labels
 */

/** The short category badges an argument can carry. */
export type ArgumentCategory = "K" | "CP" | "DA" | "T" | "Theory" | "FW"

/** One argument from the saved text, ready to draw. */
export interface ArgumentLabelPart {
  /** The argument's name with "new" (and a redundant category suffix) removed. */
  name: string
  /** Its category, or `null` when the name doesn't say. */
  category: ArgumentCategory | null
  /** True when the saved name carried the word "new". */
  isNew: boolean
}

/** The word "new" on its own, any case, with the separator that follows it. */
const NEW_WORD = /(^|[\s(-])new\b[\s:)-]*/gi

/** Ordered: the first pattern that matches decides the category. */
const CATEGORY_PATTERNS: ReadonlyArray<[ArgumentCategory, RegExp]> = [
  ["T", /^(t\b|t-|topicality\b)/i],
  ["CP", /\b(cp|counter-?plans?|pics?|states|consult(ation)?|process|delay|conditions?)\b/i],
  ["K", /\b(k|kritik|critique|cap(italism)?|set-?col|settler colonialism|afro-?pess(imism)?|anti-?blackness|baudrillard|bataille|biopower|biopolitics|security|psycho(analysis)?|lacan|queer(ness)?|queer pess|fem(inism)?|deleuze|heidegger|death cult|abolition|neolib(eralism)?|ableism|disability|wilderson|warren|nietzsche|ontology)\b/i],
  ["DA", /\b(da|disads?|disadvantages?|politics|ptx|elections?|midterms?|spending|tradeoff|trade-off)\b/i],
  ["Theory", /\b(condo|conditionality|theory|vagueness|a-?spec|o-?spec|perf con)\b/i],
  ["FW", /\b(fw|framework)\b/i],
]

/** A trailing or leading `K`/`CP`/`DA` token, dropped once the badge says it. */
const CATEGORY_TOKEN: Partial<Record<ArgumentCategory, RegExp>> = {
  K: /(^k\s+|\s+k$)/i,
  CP: /(^cp\s+|\s+cp$)/i,
  DA: /(^da\s+|\s+da$)/i,
}

/** The category an argument's name points to, or `null`. */
export function argumentCategory(name: string): ArgumentCategory | null {
  const text = name.trim()
  if (!text) return null
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category
  }
  return null
}

/** One argument name → its display part. */
export function argumentLabelPart(raw: string): ArgumentLabelPart {
  const text = raw.trim()
  let isNew = false
  const withoutNew = text
    .replace(NEW_WORD, (_match, lead: string) => {
      isNew = true
      return lead === "(" || lead === "-" ? "" : lead
    })
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
  const name = withoutNew || text
  const category = argumentCategory(name)
  const token = category ? CATEGORY_TOKEN[category] : undefined
  const shortName = token ? name.replace(token, "").trim() : name
  return { name: shortName || name, category, isNew: isNew && withoutNew !== "" }
}

/** The saved comma/newline-separated text → one part per argument. */
export function parseArgumentLabels(raw: string | null | undefined): ArgumentLabelPart[] {
  if (!raw) return []
  return raw
    .split(/[,\n;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(argumentLabelPart)
}
