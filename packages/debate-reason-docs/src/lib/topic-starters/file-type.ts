/**
 * @fileoverview What kind of argument a Topic Starters file is, from its name
 * and the folders it sits in — the colored badge the sidebar tree shows in
 * place of a file icon.
 *
 * Topic files are filed the way debaters file them: `Aff/Case/Charter Schools
 * 1AC`, `Neg/DA/Politics`, `Neg/K/Neoliberalism`, or just named
 * `Federalism CP`, `T - Substantial`, `AT Spending DA`. The classifier reads
 * the file's own title first and then each folder above it, nearest first,
 * and the first one that names a type wins. The side (Aff/Neg) comes from the
 * nearest title or folder that names one, and splits the two types that
 * depend on it: answers are an Aff's 2AC blocks (`A2`) on the Aff side and
 * case answers (`NEG`) on the Neg side; a file with no type at all is `AFF`
 * or `NEG` by side, else a plain `DOC`.
 *
 * Aff types are shades of blue; every neg type has its own hue. Pure — no
 * React, no I/O — so the tree and the tests read the same rules.
 *
 * @module lib/topic-starters/file-type
 */

/** Every badge the tree can show. */
export const TOPIC_FILE_TYPES = [
  "aff",
  "adv",
  "aff-answers",
  "neg-case",
  "t",
  "cp",
  "da",
  "k",
  "theory",
  "impact",
  "doc",
] as const
export type TopicFileType = (typeof TOPIC_FILE_TYPES)[number]

export interface TopicFileTypeStyle {
  /** The badge text — short enough to sit in a narrow sidebar. */
  label: string
  /** The full name, for the badge's tooltip and screen readers. */
  name: string
  /** Which side argues it, or null for a type either side reads. */
  side: "aff" | "neg" | null
  /** Tailwind classes for the badge's fill and text, light and dark. */
  className: string
}

export const TOPIC_FILE_TYPE_STYLES: Record<TopicFileType, TopicFileTypeStyle> = {
  aff: { label: "AFF", name: "Affirmative case", side: "aff", className: "bg-blue-600 text-white dark:bg-blue-500" },
  adv: { label: "ADV", name: "Advantage", side: "aff", className: "bg-sky-500 text-white dark:bg-sky-400 dark:text-sky-950" },
  "aff-answers": { label: "A2", name: "Aff answers (2AC blocks)", side: "aff", className: "bg-indigo-500 text-white dark:bg-indigo-400 dark:text-indigo-950" },
  "neg-case": { label: "NEG", name: "Case negative", side: "neg", className: "bg-rose-600 text-white dark:bg-rose-500" },
  t: { label: "T", name: "Topicality", side: "neg", className: "bg-amber-500 text-amber-950 dark:bg-amber-400" },
  cp: { label: "CP", name: "Counterplan", side: "neg", className: "bg-emerald-600 text-white dark:bg-emerald-500" },
  da: { label: "DA", name: "Disadvantage", side: "neg", className: "bg-red-600 text-white dark:bg-red-500" },
  k: { label: "K", name: "Kritik", side: "neg", className: "bg-purple-600 text-white dark:bg-purple-500" },
  theory: { label: "TH", name: "Theory", side: null, className: "bg-slate-500 text-white dark:bg-slate-400 dark:text-slate-950" },
  impact: { label: "IMP", name: "Impact", side: null, className: "bg-orange-500 text-white dark:bg-orange-400 dark:text-orange-950" },
  doc: { label: "DOC", name: "Document", side: null, className: "bg-muted text-muted-foreground" },
}

/** A type a title names outright, before the side is known. */
type NamedType = "aff" | "adv" | "answers" | "case" | "t" | "cp" | "da" | "k" | "theory" | "impact"

/** Lower-cased words of a title, split on anything that isn't a letter or
 *  digit, with a file extension dropped. */
function wordsOf(title: string): string[] {
  return title
    .replace(/\.(docx?|cmir|html?|pdf|txt)$/i, "")
    .toLowerCase()
    // "K-12" is a grade range, not a kritik.
    .replace(/\bk-?12\b/g, "k12")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** Words that make a title an answer only when it leads with them — "at" is
 *  ordinary English anywhere else. */
const LEADING_ANSWER_WORDS = new Set(["a2", "at", "ans", "vs"])
const ANSWER_WORDS = new Set(["a2", "answer", "answers", "2ac", "1ar", "2ar", "frontline", "frontlines"])
const K_WORDS = new Set(["k", "ks", "kritik", "kritiks", "critique", "critiques"])
const CP_WORDS = new Set(["cp", "cps", "counterplan", "counterplans", "counter"])
const DA_WORDS = new Set(["da", "das", "disad", "disads", "disadvantage", "disadvantages"])
const T_WORDS = new Set(["t", "topicality"])
const THEORY_WORDS = new Set(["theory", "framework", "fw", "spec", "condo"])
const IMPACT_WORDS = new Set(["impact", "impacts"])
const ADV_WORDS = new Set(["adv", "advs", "advantage", "advantages"])
const AFF_WORDS = new Set(["aff", "affs", "affirmative", "1ac", "plan"])
const CASE_WORDS = new Set(["case", "cases"])

const has = (words: string[], set: Set<string>) => words.some((word) => set.has(word))

/**
 * The type one title names, or null. Answers are checked first — `AT Politics
 * DA` is an answer to a DA, not a DA — but only when the title leads with the
 * answer word or says "answers", since "at" is ordinary English elsewhere.
 */
export function namedTypeOf(title: string): NamedType | null {
  const words = wordsOf(title)
  if (words.length === 0) return null
  if (LEADING_ANSWER_WORDS.has(words[0]) || has(words, ANSWER_WORDS)) return "answers"
  return offCaseTypeOf(words) ?? caseTypeOf(words)
}

/** A neg off-case position (or theory/impact) the words name, or null. */
function offCaseTypeOf(words: string[]): "k" | "cp" | "da" | "t" | "theory" | "impact" | null {
  if (has(words, K_WORDS)) return "k"
  if (has(words, CP_WORDS)) return "cp"
  if (has(words, DA_WORDS)) return "da"
  if (has(words, T_WORDS)) return "t"
  if (has(words, THEORY_WORDS)) return "theory"
  if (has(words, IMPACT_WORDS)) return "impact"
  return null
}

/** An aff case type the words name, or null. */
function caseTypeOf(words: string[]): "adv" | "aff" | "case" | null {
  if (has(words, ADV_WORDS)) return "adv"
  if (has(words, AFF_WORDS)) return "aff"
  if (has(words, CASE_WORDS)) return "case"
  return null
}

/** The side one title names, or null. */
export function namedSideOf(title: string): "aff" | "neg" | null {
  const words = wordsOf(title)
  if (words.some((word) => word === "neg" || word === "negative" || word === "negs")) return "neg"
  if (words.some((word) => word === "aff" || word === "affs" || word === "affirmative" || word === "1ac")) return "aff"
  return null
}

/**
 * A file's badge from its title and its folders' titles, nearest folder
 * first.
 */
export function classifyTopicFile(title: string, folderTitles: readonly string[] = []): TopicFileType {
  const chain = [title, ...folderTitles]
  let named: NamedType | null = null
  let side: "aff" | "neg" | null = null
  // The off-case position anywhere in the chain, answer words aside: the
  // neg's `A2 Perm` under `Neg/CP` is still a CP file.
  let offCase: TopicFileType | null = null
  for (const entry of chain) {
    named ??= namedTypeOf(entry)
    offCase ??= offCaseTypeOf(wordsOf(entry))
  }
  // The side comes from the folders before the file's own name: a file
  // called `Vouchers Aff` filed under `Neg` is the neg's file against it.
  for (const entry of [...folderTitles, title]) side ??= namedSideOf(entry)
  switch (named) {
    case "answers":
      if (side === "neg") return offCase ?? "neg-case"
      return "aff-answers"
    case "case":
      return side === "neg" ? "neg-case" : "aff"
    case "aff":
      // `Neg/Charter Schools Aff` is the neg's file against that aff.
      return side === "neg" ? "neg-case" : "aff"
    case "adv":
      return side === "neg" ? "neg-case" : "adv"
    case null:
      return side === "aff" ? "aff" : side === "neg" ? "neg-case" : "doc"
    default:
      return named
  }
}

/** The fields the classifier needs from a catalogue row. */
export interface TopicFileRow {
  id: number
  title: string
  parentId: number | null
  isFolder: boolean
}

/** Every file's badge, by id. Folders get none. */
export function topicFileTypes(rows: readonly TopicFileRow[]): Map<number, TopicFileType> {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const types = new Map<number, TopicFileType>()
  for (const row of rows) {
    if (row.isFolder) continue
    const folders: string[] = []
    const seen = new Set<number>([row.id])
    let parent = row.parentId != null ? byId.get(row.parentId) : undefined
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id)
      folders.push(parent.title)
      parent = parent.parentId != null ? byId.get(parent.parentId) : undefined
    }
    types.set(row.id, classifyTopicFile(row.title, folders))
  }
  return types
}
