/**
 * @fileoverview The watch page's "By speech" selection as URL words, so a
 * link like `?speech=2ar&tab=outcomes` opens the 2AR on its Outcomes view.
 *
 * The word is the speech's tab label (`2AR`, `1AX`, `Pro Summary`) in lower
 * case with dashes for spaces, plus a count when the label repeats — see
 * {@link speechSlug}.
 * @module lib/speech-url
 */

import type { RoundSpeech } from "./round-speeches";

/** Query parameter naming the open speech. */
export const SPEECH_PARAM = "speech";
/** Query parameter naming the view inside that speech. */
export const SPEECH_VIEW_PARAM = "tab";

/** The label in lower case with dashes, falling back to the key's code. */
function labelWord(speech: RoundSpeech): string {
  const word = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return word(speech.label) || word(speech.key.replace(/#\d+$/, ""));
}

/**
 * A speech's URL word, from the label on its tab: `2AR` → `2ar`,
 * `1AX` → `1ax`, `Pro Summary` → `pro-summary`. A label the round uses more
 * than once gets its count after the first: the second bare `CX` is `cx-2`.
 *
 * @returns The word, or `""` when `key` is not in `speeches`.
 */
export function speechSlug(speeches: RoundSpeech[], key: string): string {
  const index = speeches.findIndex((speech) => speech.key === key);
  if (index === -1) return "";
  const word = labelWord(speeches[index]);
  const occurrence = speeches.slice(0, index).filter((speech) => labelWord(speech) === word).length;
  return occurrence > 0 ? `${word}-${occurrence + 1}` : word;
}

/** The speech a URL word names, matched case-insensitively. */
export function findSpeechBySlug(speeches: RoundSpeech[], slug: string | null | undefined): RoundSpeech | undefined {
  const wanted = slug?.trim().toLowerCase();
  if (!wanted) return undefined;
  return speeches.find((speech) => speechSlug(speeches, speech.key) === wanted);
}
