/**
 * @fileoverview Builds a plain-text outline export of a round's (already
 * filtered) Argument Tree — idea #10's ("Outline Filters and Argument Tree
 * View") "Export the filtered tree to a Speech Document or outline file"
 * follow-up in TODO.md. Pure string-building only, so it's directly
 * Vitest-testable; `ArgumentTreePanel.tsx` wraps the result in a `Blob` and
 * triggers the actual browser download, mirroring
 * `round/pre-round-briefing.ts`/`flow/response-outcome-report.ts`'s exact
 * pure-builder/thin-caller split and their anchor+Blob download pattern.
 *
 * A `.docx` Speech Document export isn't attempted here, for the same
 * reason idea #6's "send to Speech Document" follow-up stayed open: the
 * only Speech Document type in this repo lives in the `reason-editor`
 * package, which this one (`debate-round`) doesn't depend on. This closes
 * the follow-up's "outline file" half instead — a downloadable snapshot of
 * exactly the flattened, filtered rows the panel is currently showing for
 * a round, suitable for pasting into a Speech Document or sharing outside
 * the app.
 *
 * @module flow/argument-tree-export
 */

import type { ArgumentTreeNode } from "./argument-tree";

/**
 * Renders a flattened (already filtered, via `filterArgumentTree` +
 * `flattenArgumentTree`) argument tree as a plain-text outline: a header
 * line naming the round, then one line per row — `## <content>` for a
 * heading, `- [<speech>] <content>` for an argument row, with any tags the
 * row carries (`argumentType`, `authorId`, `evidenceStatus`,
 * `isUnanswered`) appended in parentheses.
 */
export function buildArgumentTreeOutlineText(nodes: ArgumentTreeNode[], roundId: string): string {
  const header = `Outline — Round ${roundId}`;
  if (nodes.length === 0) {
    return `${header}\n\nNo rows match the current filter.`;
  }

  const lines = nodes.map((node) => {
    if (node.isHeading) return `## ${node.content}`;

    const tags: string[] = [];
    if (node.argumentType) tags.push(`type: ${node.argumentType}`);
    if (node.authorId) tags.push(`by: ${node.authorId}`);
    if (node.evidenceStatus) tags.push(`evidence: ${node.evidenceStatus}`);
    if (node.isUnanswered) tags.push("unanswered");
    const suffix = tags.length > 0 ? ` (${tags.join("; ")})` : "";

    return `- [${node.originSpeech}] ${node.content}${suffix}`;
  });

  return `${header}\n\n${lines.join("\n")}`;
}

/**
 * A filesystem-safe filename for an outline download, e.g.
 * `outline-round-4.txt`. Mirrors `round/pre-round-briefing.ts#preRoundBriefingFilename`'s
 * exact sanitization rule (itself mirroring `ai-versus-transcript.ts#aiVersusTranscriptFilename`).
 */
export function argumentTreeOutlineFilename(roundId: string): string {
  const safeId = roundId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `outline-${safeId || "round"}.txt`;
}
