/**
 * @fileoverview Builds a plain-text bulk export of one flow's annotations —
 * idea #15's ("Flow-in-Speech Flow Annotations") "Bulk-export a round's
 * annotations into a Speech Document" follow-up in TODO.md. Pure
 * string-building only, so it's directly Vitest-testable;
 * `FlowAnnotationsPanel.tsx` wraps the result in a `Blob` and triggers the
 * actual browser download, mirroring `round/pre-round-briefing.ts`/
 * `flow/argument-tree-export.ts`'s exact pure-builder/thin-caller split and
 * their anchor+Blob download pattern.
 *
 * A `.docx` Speech Document export isn't attempted here, for the same
 * reason idea #6's "send to Speech Document" follow-up and idea #10's own
 * outline export stayed plain-text: the only Speech Document type in this
 * repo lives in the `reason-editor` package, which this one (`debate-round`)
 * doesn't depend on. This closes the follow-up's "bulk-export" half with a
 * downloadable snapshot of every annotation on one flow (a debate round, in
 * this data model — `FlowAnnotation.flowId` is the only round-scoping field
 * an annotation carries), suitable for pasting into a Speech Document or
 * sharing outside the app.
 *
 * @module flow/flow-annotations-export
 */

import { formatAnnotationTimestamp, sortAnnotationsByTimestamp } from "debate-round/src/flow/flow-annotations";
import type { FlowAnnotation } from "debate-round/src/flow/flow-annotations";

/**
 * Renders every annotation on one flow (`flowId`), oldest first, as a
 * plain-text list: a header line naming the flow, then one line per
 * annotation — `[m:ss] <speech> box [<path>]`, with speaker/tag/note
 * appended when set. Annotations belonging to a different `flowId` are
 * ignored, so callers can pass the panel's full unfiltered annotation list
 * directly.
 */
export function buildFlowAnnotationsExportText(annotations: FlowAnnotation[], flowId: number): string {
  const header = `Flow Annotations — Flow ${flowId}`;
  const forFlow = sortAnnotationsByTimestamp(annotations.filter((a) => a.flowId === flowId));

  if (forFlow.length === 0) {
    return `${header}\n\nNo annotations for this flow.`;
  }

  const lines = forFlow.map((annotation) => {
    const timestamp = formatAnnotationTimestamp(annotation.timestampMs);
    const location = `${annotation.speechId} box [${annotation.boxPath.join(", ")}]`;

    const tags: string[] = [];
    if (annotation.speaker) tags.push(`speaker: ${annotation.speaker}`);
    if (annotation.tag) tags.push(`tag: ${annotation.tag}`);
    const suffix = tags.length > 0 ? ` (${tags.join("; ")})` : "";

    const noteLine = annotation.note ? `\n  ${annotation.note}` : "";

    return `- [${timestamp}] ${location}${suffix}${noteLine}`;
  });

  return `${header}\n\n${lines.join("\n")}`;
}

/**
 * A filesystem-safe filename for an annotations export download, e.g.
 * `flow-annotations-flow-4.txt`. Mirrors `round/pre-round-briefing.ts#preRoundBriefingFilename`'s
 * exact sanitization rule (itself mirroring `ai-versus-transcript.ts#aiVersusTranscriptFilename`),
 * applied to the flow id rather than a round id.
 */
export function flowAnnotationsExportFilename(flowId: number): string {
  const safeId = String(flowId)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `flow-annotations-flow-${safeId || "0"}.txt`;
}
