/**
 * @fileoverview The watch page's "By speech" selection as URL words, so a
 * link like `/videos/…/<teams>/2ar/outcomes` opens the 2AR on its Outcomes
 * view.
 *
 * The words are path segments after the video's own address: the speech,
 * then the view. A view alone is one segment (`…/<teams>/outcomes`); a speech
 * is always followed by its view, so one segment is never a speech the reader
 * has to tell from a view. Links from before spelled them as query
 * parameters (`?speech=2ar&tab=outcomes`); the server redirects those, and a
 * watch page at some other address (the mini player) still uses them.
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

/** The URL words of the views inside a speech, in the order they are offered. */
export const SPEECH_VIEW_WORDS = ["summary", "analysis", "transcript", "llm", "outcomes"] as const;

/** A view inside a speech, as its URL word. */
export type SpeechViewWord = (typeof SPEECH_VIEW_WORDS)[number];

/** The view a speech opens on, and so the one a speech-only link gets. */
export const DEFAULT_SPEECH_VIEW: SpeechViewWord = "summary";

/** Whether a word names a view inside a speech. */
export function isSpeechViewWord(value: string | null | undefined): value is SpeechViewWord {
  return (SPEECH_VIEW_WORDS as readonly string[]).includes(value ?? "");
}

/** The open speech and view a URL names; either may be absent. */
export interface SpeechRoute {
  speech: string | null;
  tab: string | null;
}

/**
 * The path suffix for a speech and view: `/2ar/outcomes`, `/outcomes` for a
 * view alone, and `/2ar/summary` for a speech alone (it gets the view it
 * opens on, so a lone segment is always a view).
 *
 * @returns The suffix, or `""` when neither is set.
 */
export function speechRouteSuffix(speech: string | null | undefined, tab: string | null | undefined): string {
  const speechWord = speech?.trim().toLowerCase() ?? "";
  const tabWord = tab?.trim().toLowerCase() ?? "";
  const view = isSpeechViewWord(tabWord) ? tabWord : "";
  if (speechWord) return `/${encodeURIComponent(speechWord)}/${view || DEFAULT_SPEECH_VIEW}`;
  return view ? `/${view}` : "";
}

/**
 * Reads the speech and view out of the path segments after a video's
 * address: `[]`, `[view]`, `[speech, view]`, or — typed by hand — a lone
 * `[speech]`.
 *
 * @returns The selection, or `null` when the segments are not one.
 */
export function parseSpeechRouteSuffix(segments: readonly string[]): SpeechRoute | null {
  const words = segments.map((segment) => segment.trim().toLowerCase());
  if (words.some((word) => !word)) return null;
  if (words.length === 0) return { speech: null, tab: null };
  if (words.length === 1) {
    return isSpeechViewWord(words[0]) ? { speech: null, tab: words[0] } : { speech: words[0], tab: null };
  }
  if (words.length === 2 && isSpeechViewWord(words[1])) return { speech: words[0], tab: words[1] };
  return null;
}

/** Decodes one path segment, leaving a malformed escape as it came. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * The path segments after `videoHref` in the current address, or `null` when
 * the page is not at (or under) that address.
 */
function segmentsAfter(videoHref: string | null | undefined): string[] | null {
  if (!videoHref || typeof window === "undefined") return null;
  const path = window.location.pathname.replace(/\/+$/, "");
  const base = videoHref.replace(/\/+$/, "").toLowerCase();
  const lower = decodeSegment(path).toLowerCase();
  if (lower !== base && !lower.startsWith(`${base}/`)) return null;
  return path.split("/").filter(Boolean).slice(base.split("/").filter(Boolean).length).map(decodeSegment);
}

/**
 * The speech and view the current address names: from the path after
 * `videoHref` when the page is at that address, else from the older query
 * parameters.
 */
export function readSpeechRoute(videoHref?: string | null): SpeechRoute {
  const suffix = segmentsAfter(videoHref);
  const fromPath = suffix ? parseSpeechRouteSuffix(suffix) : null;
  if (fromPath && (fromPath.speech || fromPath.tab)) return fromPath;
  if (typeof window === "undefined") return { speech: null, tab: null };
  const params = new URL(window.location.href).searchParams;
  return { speech: params.get(SPEECH_PARAM), tab: params.get(SPEECH_VIEW_PARAM) };
}

/**
 * Writes the speech and view into the address without a history entry: as
 * path segments after `videoHref` when the page is at that address (dropping
 * any older query parameters), else as query parameters.
 */
export function writeSpeechRoute(videoHref: string | null | undefined, speech: string, tab: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (segmentsAfter(videoHref)) {
    url.pathname = `${videoHref!.replace(/\/+$/, "")}${speechRouteSuffix(speech, tab)}`;
    url.searchParams.delete(SPEECH_PARAM);
    url.searchParams.delete(SPEECH_VIEW_PARAM);
  } else {
    url.searchParams.set(SPEECH_PARAM, speech);
    url.searchParams.set(SPEECH_VIEW_PARAM, tab);
  }
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
}

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
