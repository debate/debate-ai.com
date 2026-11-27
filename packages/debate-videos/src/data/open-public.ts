/**
 * @fileoverview The "Open Public" format: open (public) debates from two
 * sources, listed together at `/lectures/open_public`.
 *
 * - **Super Debate** — everything filed under "Open Super Debates", which the
 *   classifier assigns from the Super Debate channel or a "Super Debate" title
 *   (`isSuperDebateVideo`).
 * - **UNT demo debates** — lectures in "Demo Debates" whose channel or title
 *   names UNT (the University of North Texas).
 *
 * Open Public is a *view*, not a stored category: no row has `open_public` as
 * its `category_key`. A video keeps its own category and shows in Open Public
 * as well, so Demo Debates and Open Super Debates keep their contents. The
 * SQL backend builds the same predicate (`openPublicCondition` in
 * `video-repository.ts`) from {@link UNT_PHRASES}, so a listing and its count
 * agree on both backends.
 * @module data/open-public
 */

import { DEMO_CATEGORY_KEY } from "./demo-style";
import { normalizeCategoryKey } from "./video-rows";
import { normalizeCompetitorText } from "./video-query";

/** Label of the Open Public format. */
export const OPEN_PUBLIC_CATEGORY_LABEL = "Open Public";

/** {@link OPEN_PUBLIC_CATEGORY_LABEL} as a URL slug (`/lectures/open_public`). */
export const OPEN_PUBLIC_CATEGORY_KEY = "open_public";

/** The Open Super Debates category key (`open_super_debates`), Open Public's Super Debate source. */
export const SUPER_DEBATE_CATEGORY_KEY = "open_super_debates";

/**
 * Whole-word phrases, in normalized form (see `normalizeCompetitorText`), that
 * name UNT in a channel or title. Bare "north texas" is left out on purpose:
 * it is also a team name ("Emory vs North Texas").
 */
export const UNT_PHRASES: readonly string[] = ["unt", "university of north texas"];

/** The fields {@link isOpenPublicRow} reads. */
export interface OpenPublicSource {
  style: number | null;
  categoryKey: string | null;
  title: string;
  channel: string;
}

/**
 * The text UNT phrases are matched in: the normalized channel and title,
 * space-separated and padded so a phrase matches as whole words.
 *
 * @param channel - The video's channel.
 * @param title - The video's title.
 */
export function untSearchText(channel: string | null | undefined, title: string | null | undefined): string {
  return ` ${normalizeCompetitorText(channel ?? "")} ${normalizeCompetitorText(title ?? "")} `;
}

/** Whether a channel or title names UNT. */
export function namesUnt(channel: string | null | undefined, title: string | null | undefined): boolean {
  const text = untSearchText(channel, title);
  return UNT_PHRASES.some((phrase) => text.includes(` ${phrase} `));
}

/** Whether a row is a demo-debate lecture (no style, filed under Demo Debates) from UNT. */
export function isUntDemoRow(row: OpenPublicSource): boolean {
  return (
    row.style === null &&
    !!row.categoryKey &&
    normalizeCategoryKey(row.categoryKey) === DEMO_CATEGORY_KEY &&
    namesUnt(row.channel, row.title)
  );
}

/** Whether a row is in Super Debate's category, Open Super Debates. */
export function isSuperDebateRow(row: Pick<OpenPublicSource, "categoryKey">): boolean {
  return !!row.categoryKey && normalizeCategoryKey(row.categoryKey) === SUPER_DEBATE_CATEGORY_KEY;
}

/**
 * Whether a row belongs to Open Public: a Super Debate video or a UNT demo.
 *
 * @param row - A video row (or the fields of one).
 */
export function isOpenPublicRow(row: OpenPublicSource): boolean {
  return isSuperDebateRow(row) || isUntDemoRow(row);
}

/** Whether a category slug is Open Public's. */
export function isOpenPublicKey(key: string | null | undefined): boolean {
  return !!key && normalizeCategoryKey(key) === OPEN_PUBLIC_CATEGORY_KEY;
}
