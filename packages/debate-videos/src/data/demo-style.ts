/**
 * @fileoverview The debate format of a "Demo Debates" lecture.
 *
 * A demo debate is a lecture-library video (it has no numeric `style`) that is
 * nonetheless a round: someone debates it start to finish to show how the
 * format is done. It gets the round watch page (speech detection, the speech
 * timeline, per-speech tabs) once it knows which format it is, and that format
 * is a `DebateStyle` — the same enum rounds use, so PF demos, Policy demos and
 * so on need no second list.
 *
 * The format is stored in `videos.demo_style` when an admin picks it, and
 * otherwise guessed from the title ({@link guessDemoStyle}). The guess is
 * written as phrase lists rather than regexes because the SQL backend builds
 * the same `CASE` from them (see `demoStyleSql` in `video-repository.ts`), so
 * the style filter and counts agree with what the watch page shows.
 * @module data/demo-style
 */

import { DEBATE_STYLE_LABELS, type DebateStyle } from "../types/videos";
import { normalizeCompetitorText } from "./video-query";
import { normalizeCategoryKey } from "./video-rows";

/** The lecture category demo debates are filed under. */
export const DEMO_CATEGORY_LABEL = "Demo Debates";

/** {@link DEMO_CATEGORY_LABEL} as a URL slug (`/videos/demo_debates`). */
export const DEMO_CATEGORY_KEY = "demo_debates";

/**
 * Words in a title that name a format, most specific first: the first style
 * with a phrase in the title wins, so "college policy" is College, not Policy.
 * Phrases are lowercase words, matched whole against the normalized title.
 */
export const DEMO_STYLE_PHRASES: ReadonlyArray<{ style: DebateStyle; phrases: readonly string[] }> = [
  { style: 8, phrases: ["parli", "parliamentary", "npda", "npte", "apda", "npdl", "npdi"] },
  { style: 9, phrases: ["congress", "student congress"] },
  { style: 5, phrases: ["wsd", "worlds", "world schools"] },
  { style: 2, phrases: ["pf", "public forum"] },
  { style: 3, phrases: ["ld", "lincoln douglas"] },
  { style: 4, phrases: ["ndt", "ceda", "college", "collegiate"] },
  { style: 1, phrases: ["policy", "cx"] },
];

/**
 * Whether a category (label or slug) is the demo-debate category.
 *
 * @param category - Stored category label or key; `null` for none.
 */
export function isDemoCategory(category: string | null | undefined): boolean {
  return !!category && normalizeCategoryKey(category) === DEMO_CATEGORY_KEY;
}

/** Whether `phrase` occurs as whole words in an already-normalized title. */
function hasPhrase(normalizedTitle: string, phrase: string): boolean {
  return ` ${normalizedTitle} `.includes(` ${phrase} `);
}

/**
 * Guesses a demo's format from its title.
 *
 * @param title - The video's title.
 * @returns The `DebateStyle` the title names, or `null` when it names none.
 */
export function guessDemoStyle(title: string | null | undefined): DebateStyle | null {
  if (!title) return null;
  const normalized = normalizeCompetitorText(title);
  for (const { style, phrases } of DEMO_STYLE_PHRASES) {
    if (phrases.some((phrase) => hasPhrase(normalized, phrase))) return style;
  }
  return null;
}

/** The fields {@link resolveDemoStyle} reads off a row. */
interface DemoStyleSource {
  style?: number | null;
  category?: string | null;
  title?: string | null;
  /** The stored (admin-chosen) format, when there is one. */
  demoStyle?: number | null;
}

/**
 * Narrows a stored value to a style this app knows.
 *
 * @param value - A `demo_style` column value or tuple slot.
 */
export function asDebateStyle(value: unknown): DebateStyle | null {
  return typeof value === "number" && value in DEBATE_STYLE_LABELS ? (value as DebateStyle) : null;
}

/**
 * The format a demo-debate lecture is shown in: the admin's pick, else the
 * title's guess. `null` for anything that is not an unstyled demo — a round
 * has its own `style`, and every other lecture is just a lecture.
 *
 * @param source - A row (or the fields of one).
 */
export function resolveDemoStyle(source: DemoStyleSource): DebateStyle | null {
  if (source.style != null || !isDemoCategory(source.category)) return null;
  return asDebateStyle(source.demoStyle) ?? guessDemoStyle(source.title);
}

/**
 * The plural a demo gallery groups under: "PF demos", "Policy demos".
 *
 * @param style - A demo's format.
 */
export function demoStyleGroupLabel(style: DebateStyle): string {
  return `${DEBATE_STYLE_LABELS[style]} demos`;
}

/** Position of the demo's stored format in the video tuple. */
export const DEMO_STYLE_TUPLE_SLOT = 21;

/**
 * Whether a video tuple is a lecture filed under the demo-debate category.
 *
 * @param tuple - A video tuple (index 6 is the style or category).
 */
export function isDemoTuple(tuple: readonly unknown[]): boolean {
  return typeof tuple[6] === "string" && isDemoCategory(tuple[6]);
}

/**
 * The format of a demo-debate video tuple, resolved: the tuple's own slot
 * ({@link DEMO_STYLE_TUPLE_SLOT}) when the feed sent one, else the title's
 * guess.
 *
 * @param tuple - A video tuple (index 6 is the style or category).
 * @returns The format, or `null` when the video is not an unstyled demo or names none.
 */
export function demoStyleOfTuple(tuple: readonly unknown[]): DebateStyle | null {
  const category = tuple[6];
  if (typeof category !== "string") return null;
  return resolveDemoStyle({
    category,
    title: typeof tuple[1] === "string" ? tuple[1] : "",
    demoStyle: asDebateStyle(tuple[DEMO_STYLE_TUPLE_SLOT]),
  });
}
