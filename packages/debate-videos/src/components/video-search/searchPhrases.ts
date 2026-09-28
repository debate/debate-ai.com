/**
 * @fileoverview Suggested search phrases for the video search dropdown.
 *
 * Each library category gets its own hand-picked set of phrases, so opening
 * the search box on the Kritik lectures offers different starting points than
 * opening it on PF rounds. No phrase appears in more than one set.
 * @module components/debate/DebateVideos/components/video-search/searchPhrases
 */

import { normalizeCategoryKey } from "debate-data-sync/src/videos/video-rows"
import type { CategoryType, DebateStyle } from "../../types/videos"

/** Phrases per debate style, used whenever a style filter is active. */
const STYLE_PHRASES: Record<DebateStyle, string[]> = {
  1: ["NDT finals", "TOC policy elims", "1AC plan text", "politics DA", "states counterplan", "2NR on the K"],
  2: ["PF grand crossfire", "summary extension", "final focus weighing", "PF TOC finals", "turns in rebuttal", "PF evidence ethics"],
  3: ["LD value criterion", "Kant framework", "LD philosophy", "tricks debate", "1AR strategy", "LD TOC finals"],
  4: ["CEDA elims", "college K aff", "NDT octafinals", "college topic lecture", "performance debate", "college policy finals"],
}

/**
 * Phrases per lecture category, keyed by the category's slug (see
 * `normalizeCategoryKey`), so both the label and the URL slug resolve.
 */
const LECTURE_PHRASES: Record<string, string[]> = {
  [normalizeCategoryKey("Novice & Introductory")]: ["how debate works", "novice lecture", "what is a flow", "first tournament tips", "speech times explained"],
  [normalizeCategoryKey("Topic Lectures")]: ["topic analysis", "resolution breakdown", "aff ground on the topic", "topic literature", "camp topic lecture"],
  [normalizeCategoryKey("Affirmative Strategy")]: ["writing a 1AC", "2AC blocks", "aff case construction", "answering counterplans", "solvency advocate"],
  [normalizeCategoryKey("Negative Strategy")]: ["neg block strategy", "2NR collapse", "case turns", "neg strategy lecture", "picking a 2NR"],
  [normalizeCategoryKey("Kritik / Critical Theory")]: ["capitalism kritik", "afropessimism", "security K", "alternative explained", "K framework"],
  [normalizeCategoryKey("Counterplans & Theory")]: ["conditionality bad", "PIC theory", "process counterplans", "perm do both", "advantage counterplan"],
  [normalizeCategoryKey("Topicality & Framework")]: ["topicality violation", "competing interpretations", "limits and ground", "fairness vs education", "reasonability"],
  [normalizeCategoryKey("Disadvantages")]: ["uniqueness and link", "link turns", "elections DA", "internal link chain", "DA vs case"],
  [normalizeCategoryKey("Impact Calculus & Evidence")]: ["magnitude probability timeframe", "impact comparison", "card cutting", "evidence quality", "reading evidence"],
  [normalizeCategoryKey("Speaking & Delivery")]: ["speed drills", "clarity drills", "persuasive speaking", "cross-examination tips", "speaker points"],
  [normalizeCategoryKey("Research & Flowing")]: ["flowing tutorial", "research techniques", "Verbatim setup", "cutting cards fast", "organizing files"],
  [normalizeCategoryKey("Public Forum")]: ["PF case writing", "PF crossfire tips", "PF weighing mechanisms", "second speaker duties", "PF lay judges"],
  [normalizeCategoryKey("Demo Debates")]: ["demo round", "practice debate", "demo with commentary", "camp demo", "redo speeches"],
  [normalizeCategoryKey("Judge & Tournament Skills")]: ["judge adaptation", "writing a ballot", "judge philosophy", "tournament prep", "post-round questions"],
  [normalizeCategoryKey("Philosophy & IR Theory")]: ["realism vs liberalism", "Foucault biopower", "deontology vs consequentialism", "hegemony theory", "Rawls veil of ignorance"],
  [normalizeCategoryKey("Camp & Coaching Advice")]: ["coaching advice", "building a squad", "camp choices", "debate career advice", "drills for coaches"],
  [normalizeCategoryKey("Documentaries & Culture")]: ["debate documentary", "Resolved documentary", "history of debate", "debate interviews", "urban debate league"],
}

/** Phrases per top-level view, used when no style or lecture category narrows it. */
const VIEW_PHRASES: Partial<Record<CategoryType, string[]>> = {
  lectures: ["intro to debate", "advanced strategy lecture", "rebuttal redos", "theory lecture", "debate camp lab"],
  rounds: ["finals round", "semifinals", "quarterfinals", "bid round", "elimination debate"],
  topPicks: ["best final rounds", "classic rounds", "championship debate", "must-watch lecture", "top speaker"],
  history: ["watched rounds", "rewatch lecture", "continue watching", "past finals", "recent views"],
}

/** Inputs that decide which phrase set applies. */
export interface SearchPhraseScope {
  /** Top-level view of the video library. */
  currentCategory?: CategoryType
  /** Active debate-style filter, if any. */
  selectedStyle?: DebateStyle | ""
  /** Active lecture category label or slug, or `"all"`. */
  selectedCategory?: string
}

/**
 * Returns the suggested phrases for the most specific active category: a
 * debate style wins over a lecture category, which wins over the view.
 *
 * @param scope - The page's current category/filter state.
 * @returns The phrase set for that category (empty when none is defined).
 */
export function getSearchPhrases({
  currentCategory,
  selectedStyle,
  selectedCategory,
}: SearchPhraseScope): string[] {
  if (selectedStyle) return STYLE_PHRASES[selectedStyle] ?? []
  if (currentCategory === "lectures" && selectedCategory && selectedCategory !== "all") {
    const phrases = LECTURE_PHRASES[normalizeCategoryKey(selectedCategory)]
    if (phrases) return phrases
  }
  return (currentCategory && VIEW_PHRASES[currentCategory]) || VIEW_PHRASES.lectures!
}

/** Every phrase set, exposed so tests can check the sets stay distinct. */
export const ALL_PHRASE_SETS: string[][] = [
  ...Object.values(STYLE_PHRASES),
  ...Object.values(LECTURE_PHRASES),
  ...Object.values(VIEW_PHRASES),
]
