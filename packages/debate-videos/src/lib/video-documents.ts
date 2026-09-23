/**
 * @fileoverview The long-form documents that sit beside a video: the full
 * speech-by-speech transcript, the AI summary of it, the written analysis.
 *
 * A round's transcript is not a paragraph, it is eight or nine speeches and
 * tens of thousands of words. Handed to a reader as one wall of text it is
 * unusable — you cannot find the 2NR, you cannot tell how long the 1AR ran,
 * and you certainly cannot follow it against the video. So a document is
 * markdown whose `##` headings name its speeches, and this module is the
 * parser both sides share: the watch page's panel builds its jump list and
 * its per-speech word counts from {@link parseDocumentSections}, and the
 * admin editor counts words the same way so the two never disagree.
 *
 * A heading may carry the moment the speech starts, in brackets, parentheses
 * or after a dash — `## 1AC — Michigan (2:15)` — and that is what lets a
 * click on a speech seek the video to it. A heading without one still works;
 * it just isn't clickable.
 * @module lib/video-documents
 */

import { groupIntoSentences } from "../components/transcript/transcriptUtils";

/** Which kinds of document a video can carry, in the order the tabs show them. */
export const VIDEO_DOCUMENT_KINDS = ["transcript", "summary", "analysis"] as const;

export type VideoDocumentKind = (typeof VIDEO_DOCUMENT_KINDS)[number];

/** Tab label and blurb for each kind. */
export const VIDEO_DOCUMENT_LABELS: Record<
  VideoDocumentKind,
  { label: string; description: string }
> = {
  transcript: {
    label: "Speeches",
    description: "The full transcript of every speech in this round.",
  },
  summary: {
    label: "Summary",
    description: "An AI-written summary of the round, speech by speech.",
  },
  analysis: {
    label: "Analysis",
    description: "Written analysis of the arguments and the decision.",
  },
};

/** Narrows an arbitrary string to a known document kind. */
export function isVideoDocumentKind(value: unknown): value is VideoDocumentKind {
  return typeof value === "string" && (VIDEO_DOCUMENT_KINDS as readonly string[]).includes(value);
}

/** One document as the watch page and the admin editor exchange it. */
export interface VideoDocument {
  videoId: string;
  kind: VideoDocumentKind;
  /** Panel heading; falls back to the kind's label when absent. */
  title?: string | null;
  body: string;
  /** `editor`, `ai`, or `youtube` for a cleaned-up caption dump. */
  author?: string | null;
  /** Model behind an `ai` document, shown in the attribution line. */
  model?: string | null;
  wordCount?: number;
  updatedAt?: string | number | null;
}

/** One `##` section of a document — in a transcript, one speech. */
export interface DocumentSection {
  /** Heading text with any timecode removed, e.g. `"1AC — Michigan"`. */
  heading: string;
  /** Second the section starts at, when the heading named one. */
  startSeconds: number | null;
  /** The section's own text, headings excluded. */
  body: string;
  wordCount: number;
}

/**
 * Counts words the way a reader would — runs of non-whitespace, with
 * markdown heading markers left out so a 12-speech transcript is not
 * credited with 12 extra words.
 */
export function countWords(body: string): number {
  const prose = (body ?? "").replace(/^#{1,6}\s+/gm, "");
  const matches = prose.match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * Reads `h:mm:ss`, `m:ss` or a bare minute count as seconds.
 *
 * @param value - Timecode text, without surrounding brackets.
 * @returns Seconds, or `null` when the text is not a timecode.
 */
export function parseTimecode(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,2}(:[0-5]?\d){1,2}$/.test(trimmed)) return null;
  const parts = trimmed.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** Formats seconds as `m:ss`, or `h:mm:ss` past an hour. */
export function formatTimecode(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The timecode a heading carries, and the heading without it.
 *
 * Three shapes are accepted because all three are what people actually type:
 * `1AC [2:15]`, `1AC (2:15)` and `1AC — 2:15`.
 */
function splitHeadingTimecode(heading: string): { heading: string; startSeconds: number | null } {
  const bracketed = heading.match(/^(.*?)[\s]*[[(]\s*(\d{1,2}(?::[0-5]?\d){1,2})\s*[\])]\s*$/);
  if (bracketed) {
    const seconds = parseTimecode(bracketed[2]);
    if (seconds !== null) return { heading: bracketed[1].trim(), startSeconds: seconds };
  }

  const trailing = heading.match(/^(.*?)\s*[—–-]\s*(\d{1,2}(?::[0-5]?\d){1,2})\s*$/);
  if (trailing) {
    const seconds = parseTimecode(trailing[2]);
    if (seconds !== null) return { heading: trailing[1].trim(), startSeconds: seconds };
  }

  return { heading: heading.trim(), startSeconds: null };
}

/**
 * Splits a document into its `##` sections.
 *
 * Text before the first heading becomes an untitled opening section rather
 * than being dropped, so a document that is simply prose still renders — the
 * panel then just has nothing to jump between.
 *
 * @param body - The document's markdown.
 * @returns One entry per section, in document order.
 */
export function parseDocumentSections(body: string): DocumentSection[] {
  const text = (body ?? "").replace(/\r\n/g, "\n");
  if (!text.trim()) return [];

  const sections: DocumentSection[] = [];
  let current: { heading: string; startSeconds: number | null; lines: string[] } = {
    heading: "",
    startSeconds: null,
    lines: [],
  };

  const push = () => {
    const sectionBody = current.lines.join("\n").trim();
    // An empty lead-in (a document that opens straight on a heading) is not
    // a section; an empty *named* section is, because the heading is itself
    // information — that speech exists and has not been typed up yet.
    if (!current.heading && !sectionBody) return;
    sections.push({
      heading: current.heading,
      startSeconds: current.startSeconds,
      body: sectionBody,
      wordCount: countWords(sectionBody),
    });
  };

  for (const line of text.split("\n")) {
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    if (heading) {
      push();
      const split = splitHeadingTimecode(heading[1]);
      current = { heading: split.heading, startSeconds: split.startSeconds, lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  push();

  return sections;
}

/** Splits a section's text into paragraphs for rendering. */
export function toParagraphs(body: string): string[] {
  return (body ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/**
 * Orders documents the way the tabs show them, and drops empty ones.
 *
 * The YouTube caption tab is always first and is not one of these; these
 * follow it in {@link VIDEO_DOCUMENT_KINDS} order, so a video that has a
 * summary but no typed-up transcript shows Summary in the second slot rather
 * than leaving a gap.
 */
export function orderDocuments(documents: VideoDocument[]): VideoDocument[] {
  return documents
    .filter((document) => (document.body ?? "").trim().length > 0)
    .sort(
      (a, b) => VIDEO_DOCUMENT_KINDS.indexOf(a.kind) - VIDEO_DOCUMENT_KINDS.indexOf(b.kind),
    );
}

/** One timed caption cue, as `/api/transcript` returns them. */
export interface CaptionCue {
  text: string;
  start: number;
  duration: number;
}

/**
 * A silence this long between two caption cues is read as the break between
 * speeches — prep time, the next speaker walking up — and starts a new
 * section. Shorter pauses are just someone breathing.
 */
const SPEECH_GAP_SECONDS = 20;

/**
 * A section that runs this long with no such pause is split anyway, so a
 * caption dump never lands in the editor as one heading over an hour of text.
 */
const MAX_SECTION_SECONDS = 600;

/** Sentences per paragraph, so the imported text is not one unbroken block. */
const SENTENCES_PER_PARAGRAPH = 5;

/**
 * Turns YouTube's caption cues into a starting draft for a transcript
 * document, in the house style: `##` sections whose headings carry the
 * timecode they start at, so the draft is navigable on the watch page the
 * moment it is saved.
 *
 * Headings are placeholders (`Part 1 (0:00)`) — the importer cannot know
 * which speech is which, so an editor renames them `1AC — Michigan (0:00)`.
 * Sections break on a long silence, which in a round is usually the gap
 * between speeches, or every ten minutes when there is none.
 *
 * @param cues - Caption cues in playback order.
 * @returns Markdown, or an empty string when there are no cues.
 */
export function captionsToTranscriptMarkdown(cues: CaptionCue[]): string {
  const sentences = groupIntoSentences(cues.filter((cue) => cue.text.trim().length > 0));
  if (sentences.length === 0) return "";

  const sections: { start: number; sentences: string[] }[] = [];
  let current: { start: number; sentences: string[] } | null = null;
  let previousEnd = 0;

  for (const sentence of sentences) {
    const gap = sentence.start - previousEnd;
    if (
      !current ||
      gap >= SPEECH_GAP_SECONDS ||
      sentence.start - current.start >= MAX_SECTION_SECONDS
    ) {
      current = { start: sentence.start, sentences: [] };
      sections.push(current);
    }
    current.sentences.push(sentence.text);
    previousEnd = sentence.start + sentence.duration;
  }

  return sections
    .map((section, index) => {
      const paragraphs: string[] = [];
      for (let i = 0; i < section.sentences.length; i += SENTENCES_PER_PARAGRAPH) {
        paragraphs.push(section.sentences.slice(i, i + SENTENCES_PER_PARAGRAPH).join(" "));
      }
      return `## Part ${index + 1} (${formatTimecode(section.start)})\n\n${paragraphs.join("\n\n")}`;
    })
    .join("\n\n");
}
