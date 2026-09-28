/**
 * @fileoverview Extract heading titles from speech document markdown
 * @module components/debate/flow/utils/speech-doc-headings
 */

export interface SpeechDocHeading {
  level: number;
  text: string;
  raw: string;
}

/**
 * Extract heading titles from markdown content.
 * Returns headings up to the specified depth (default 3 for ## headings).
 */
export function extractSpeechDocHeadings(
  markdown: string,
  options: { depth?: number } = {}
): SpeechDocHeading[] {
  const depth = options.depth ?? 3;
  const headingPattern = new RegExp(`^#{1,${depth}}\\s+(.*)$`, "gm");
  const headings: SpeechDocHeading[] = [];

  for (const line of markdown.split("\n")) {
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      const level = match[1].length;
      if (level <= depth) {
        headings.push({
          level,
          text: match[2].trim(),
          raw: line.trim(),
        });
      }
    }
  }

  return headings;
}

/**
 * Format headings for display in the room.
 * Returns a simple string representation suitable for broadcasting.
 */
export function formatHeadingsForDisplay(headings: SpeechDocHeading[]): string {
  return headings
    .map((h) => `${"#".repeat(h.level)} ${h.text}`)
    .join("\n");
}

/**
 * Parse headings from a formatted string (reverse of formatHeadingsForDisplay).
 */
export function parseHeadingsFromDisplay(formatted: string): SpeechDocHeading[] {
  const headings: SpeechDocHeading[] = [];
  for (const line of formatted.split("\n")) {
    const match = line.match(/^(#+)\s+(.*)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        raw: line.trim(),
      });
    }
  }
  return headings;
}