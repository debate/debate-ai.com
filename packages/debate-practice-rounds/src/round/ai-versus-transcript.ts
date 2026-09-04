/**
 * @fileoverview Builds a plain-text transcript of an "Online Debate Versus
 * AI" round — the "a transcript export/download action for a completed
 * round" follow-up named under idea #3 ("Online Debate Versus AI") in
 * TODO.md's Product Feature Ideas list. Pure string-building only, so it's
 * directly Vitest-testable; `AiVersusRoundPanel.tsx` wraps the result in a
 * `Blob` and triggers the actual browser download (the same anchor+Blob
 * pattern `dialogs/FileExportDialog.tsx` already uses), mirroring this
 * repo's existing pure-builder/thin-caller split (e.g.
 * `ai-versus-speech-ai.ts` vs `ai-versus-speech-client.ts`).
 *
 * @module round/ai-versus-transcript
 */

import {
  debateStyleMap,
  debateStyleNames,
  debateStyles,
  type DebateStyleKey,
} from "debate-timer/src/formats/debate-format-times";
import type { AiVersusRoundRecord } from "debate-round/src/state/aiVersusRounds";
import type { AiVersusSide } from "debate-round/src/round/ai-versus-speech-order";

function styleDisplayName(styleKey: DebateStyleKey): string {
  const index = debateStyleMap.indexOf(styleKey);
  return index === -1 ? styleKey : debateStyleNames[index]!;
}

function sideDisplayName(styleKey: DebateStyleKey, side: AiVersusSide): string {
  const style = debateStyles[styleKey];
  return side === "primary" ? style.primary.name : (style.secondary?.name ?? side);
}

/**
 * Renders a round's header (round id, format, the user's side) followed by
 * every delivered speech in delivery order, each labeled "You" or "AI" plus
 * its slot name. Works for a round in any state of completion — an empty or
 * partially-delivered round still renders a valid transcript, with a
 * placeholder line when no speeches have been submitted yet; the panel
 * decides whether to only offer the download once a round is complete.
 */
export function buildAiVersusTranscriptText(record: AiVersusRoundRecord): string {
  const header = [
    `Online Debate Versus AI — Round ${record.roundId}`,
    `Format: ${styleDisplayName(record.styleKey)}`,
    `Your side: ${sideDisplayName(record.styleKey, record.userSide)}`,
  ].join("\n");

  if (record.submittedSpeeches.length === 0) {
    return `${header}\n\nNo speeches have been delivered yet.\n`;
  }

  const body = record.submittedSpeeches
    .map((speech) => `${speech.speaker === "user" ? "You" : "AI"} — ${speech.name}\n${speech.text}`)
    .join("\n\n");

  return `${header}\n\n${body}\n`;
}

/**
 * A filesystem-safe filename for a round's transcript download, e.g.
 * `ai-versus-round-1-transcript.txt`. Non-alphanumeric characters in the
 * round id (spaces, slashes, etc.) collapse to single hyphens so the id can
 * be anything a user typed into the "Round ID" field.
 */
export function aiVersusTranscriptFilename(roundId: string): string {
  const safeId = roundId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `ai-versus-${safeId || "round"}-transcript.txt`;
}
