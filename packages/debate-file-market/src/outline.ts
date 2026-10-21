/**
 * @fileoverview The free preview of a file for sale: its table of contents.
 *
 * Debate Editor renders the Verbatim outline as headings — pocket `h1`, hat
 * `h2`, block `h3`, tag `h4` — and everything a buyer pays for (cites, card
 * text, highlighting, analytics) sits outside them. So the preview is the
 * heading text and nothing else.
 *
 * Regex rather than a DOM parser so the same code runs in the Worker, in the
 * browser and in tests.
 *
 * @module debate-file-market/outline
 */

import type { OutlineEntry, OutlineLevel } from "./types";

/** The most headings a preview keeps. */
export const MAX_OUTLINE_ENTRIES = 1000;
/** The longest heading a preview keeps, in characters. */
export const MAX_HEADING_LENGTH = 200;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[name.toLowerCase()] ?? match;
  });
}

function cleanHeading(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_HEADING_LENGTH);
}

/** The `h1`–`h4` headings of `html`, in document order, as plain text. */
export function outlineFromHtml(html: string): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  const heading = /<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = heading.exec(html)) && entries.length < MAX_OUTLINE_ENTRIES) {
    const text = cleanHeading(decodeEntities(match[2].replace(/<[^>]*>/g, " ")));
    if (text) entries.push({ level: Number(match[1]) as OutlineLevel, text });
  }
  return entries;
}

/**
 * Validates an outline the browser sent. Returns `null` when it is not an
 * array; drops entries that are not `{ level: 1–4, text }`, and trims and
 * caps what remains.
 */
export function sanitizeOutline(input: unknown): OutlineEntry[] | null {
  if (!Array.isArray(input)) return null;
  const entries: OutlineEntry[] = [];
  for (const item of input) {
    if (entries.length >= MAX_OUTLINE_ENTRIES) break;
    if (!item || typeof item !== "object") continue;
    const { level, text } = item as { level?: unknown; text?: unknown };
    if (level !== 1 && level !== 2 && level !== 3 && level !== 4) continue;
    if (typeof text !== "string") continue;
    const clean = cleanHeading(text);
    if (clean) entries.push({ level, text: clean });
  }
  return entries;
}
