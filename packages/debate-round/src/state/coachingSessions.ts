/**
 * @fileoverview Persistent storage for `coach-mode.ts`'s derived
 * `CoachingPrompt[]` coaching session, keyed by `roundId` + `sideKey` — the
 * "(c) persisting a generated coaching session per round" follow-up named
 * under "AI Coach Mode" in TODO.md's Research Crowdsourcing Organizer
 * Features list. Stores sessions in localStorage, mirroring the existing
 * `flowSummaries.ts`/`drillSets.ts` persistence convention. Keyed by both
 * `roundId` and `sideKey` (rather than `roundId` alone) because
 * `buildCoachingSession` is generated per side — a round can have a
 * separately-generated session for each side represented in its flow.
 *
 * `aiFeedback` is additive and optional (existing records without it stay
 * valid) — it holds `round/coach-feedback-client.ts`'s open-ended AI
 * coaching feedback for this session, once a caller has generated one; see
 * `saveCoachingSessionAiFeedback` below, closing follow-up (a) named under
 * the same bullet.
 *
 * `createdAt` and `coachingSessionNews()` below close the "a coaching
 * session" half of the Known gap recorded in `docs/features/news-stream.md`
 * — left open there because `debate-card-search` (where News Stream's other
 * Community sources live) already depends on nothing here, and this
 * package taking a dependency back on it for a coaching-session source
 * would be a cycle. This package already depends on `debate-card-search`
 * (see `flow/flow-note-suggestions.ts`), so the reverse composition works:
 * `coachingSessionNews()` lives here and is passed into `buildNewsFeed`'s
 * new `extraItems` parameter at the app layer
 * (`apps/debate-ai.com/app/news/page.tsx`), which already depends on both
 * packages.
 *
 * `saveCoachingSession` now snapshots the record it overwrites into
 * `state/coachingSessionHistory.ts` before replacing it, and
 * `deleteCoachingSession` clears that pair's whole snapshot history too —
 * the "a coaching-session history timeline per round" follow-up named under
 * the same bullet.
 *
 * `buildCoachingSessionComparison`/`buildCoachingSessionComparisonText`
 * below close the "a side-by-side comparison across two rounds" follow-up
 * named under the same bullet — the one remaining open item once the
 * history timeline shipped. Both operate on two already-persisted
 * `CoachingSessionRecord`s; no new coaching-prompt derivation logic is
 * introduced.
 *
 * @module state/coachingSessions
 */

import type { Flow } from "../types/flow";
import type { NewsItem } from "debate-card-search/src/lib/news-stream";
import {
  buildCoachingSession,
  buildCoachingSummaryText,
  type CoachingPrompt,
  type CoachingPromptKind,
} from "../flow/coach-mode";
import {
  appendCoachingSessionVersion,
  deleteVersionsForCoachingSession,
  type CoachingSessionHistoryEntry,
} from "./coachingSessionHistory";

export type CoachingSessionRecord = {
  roundId: string;
  sideKey: string;
  prompts: CoachingPrompt[];
  /** Open-ended AI coaching feedback for this session, if one has been generated. */
  aiFeedback?: string;
  /** Epoch milliseconds the session was first generated, if generated after this field existed. */
  createdAt?: number;
};

const STORAGE_KEY = "coachingSessions";

function readAll(): CoachingSessionRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CoachingSessionRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: CoachingSessionRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function matches(record: CoachingSessionRecord, roundId: string, sideKey: string): boolean {
  return record.roundId === roundId && record.sideKey === sideKey;
}

/** Lists every persisted coaching session, across all rounds and sides. */
export function listCoachingSessions(): CoachingSessionRecord[] {
  return readAll();
}

/** Looks up a round's persisted coaching session for a side, if any. */
export function getCoachingSession(roundId: string, sideKey: string): CoachingSessionRecord | undefined {
  return readAll().find((record) => matches(record, roundId, sideKey));
}

/** Lists every persisted coaching session for a round, across all sides. */
export function getCoachingSessionsForRound(roundId: string): CoachingSessionRecord[] {
  return readAll().filter((record) => record.roundId === roundId);
}

/** Result of a `saveCoachingSession` call — the saved record, plus the version snapshot it created, if any. */
export type SaveCoachingSessionResult = {
  record: CoachingSessionRecord;
  /** The prior record's snapshot, present only when this save overwrote an existing roundId+sideKey pair. */
  version?: CoachingSessionHistoryEntry;
};

/**
 * Saves a round+side's coaching session, overwriting any existing record
 * for that pair. Overwriting snapshots the record it replaces into
 * `state/coachingSessionHistory.ts` first, so a regenerated session never
 * loses the prior one outright — see that module's
 * `listVersionsForCoachingSession`.
 */
export function saveCoachingSession(record: CoachingSessionRecord): SaveCoachingSessionResult {
  const records = readAll();
  const index = records.findIndex((existing) => matches(existing, record.roundId, record.sideKey));
  if (index === -1) {
    records.push(record);
    writeAll(records);
    return { record };
  }

  const version = appendCoachingSessionVersion(records[index] as CoachingSessionRecord);
  records[index] = record;
  writeAll(records);
  return { record, version };
}

/**
 * Deletes a round+side's persisted coaching session, along with every
 * history snapshot `saveCoachingSession` archived for that pair — a "Clear"
 * fully resets the round+side rather than leaving orphaned history behind.
 * A no-op if it isn't stored.
 */
export function deleteCoachingSession(roundId: string, sideKey: string): void {
  writeAll(readAll().filter((record) => !matches(record, roundId, sideKey)));
  deleteVersionsForCoachingSession(roundId, sideKey);
}

/**
 * Sets a round+side's persisted `aiFeedback` (`round/coach-feedback-client.ts`'s
 * `requestCoachFeedback` result), leaving its `prompts` untouched. A no-op
 * when the roundId/sideKey pair isn't stored — a feedback call is only ever
 * made against an already-generated, already-persisted session.
 */
export function saveCoachingSessionAiFeedback(roundId: string, sideKey: string, aiFeedback: string): void {
  const records = readAll();
  const index = records.findIndex((existing) => matches(existing, roundId, sideKey));
  if (index === -1) return;
  records[index] = { ...records[index], aiFeedback };
  writeAll(records);
}

/**
 * Every persisted coaching session, sorted by `roundId` then `sideKey` for a
 * stable display order — the "(b) a coaching-panel UI that reads/writes
 * through the persistence store" follow-up named under the "🎙️ AI Coach
 * Mode" bullet in TODO.md. Used by `panels/CoachingSessionsPanel.tsx`.
 */
export function buildCoachingSessionsPanelView(): CoachingSessionRecord[] {
  return [...listCoachingSessions()].sort(
    (a, b) => a.roundId.localeCompare(b.roundId) || a.sideKey.localeCompare(b.sideKey),
  );
}

/**
 * Derives a round+side's coaching session from an already-flowed `Flow` and
 * persists it in one step — the "generate a new coaching session for a
 * round" affordance named in `docs/features/coaching-sessions.md`'s Known
 * gaps. Lets a caller with a live flow (e.g. the round workspace's currently
 * selected flow) create a `CoachingSessionRecord` without hand-building it,
 * mirroring `drillSets.ts`'s `buildAndSaveDrillSet`. Overwrites any existing
 * session for that `roundId`+`sideKey` pair, same as `saveCoachingSession`.
 */
export function buildAndSaveCoachingSession(
  flow: Pick<Flow, "children" | "columns">,
  roundId: string,
  sideKey: string,
  options: { collapseLimit?: number } = {},
): CoachingSessionRecord {
  const record: CoachingSessionRecord = {
    roundId,
    sideKey,
    prompts: buildCoachingSession(flow, sideKey, options),
    createdAt: Date.now(),
  };
  saveCoachingSession(record);
  return record;
}

/**
 * Renders a round+side's persisted coaching session as a downloadable
 * plain-text coaching-notes document — the "an exportable coaching-notes
 * document" follow-up named under the "🎙️ AI Coach Mode" bullet in
 * TODO.md. Mirrors `pre-round-briefing.ts#buildPreRoundBriefingText`'s
 * heading shape (a titled header over the rendered body), reusing
 * `buildCoachingSummaryText` for the template-prompts section and appending
 * the session's open-ended AI feedback, if one has been generated, as its
 * own labeled section.
 */
export function buildCoachingNotesText(session: CoachingSessionRecord): string {
  const promptsText = buildCoachingSummaryText(session.prompts);
  const feedbackSection = session.aiFeedback ? `\n\n### AI Feedback\n${session.aiFeedback}` : "";
  return `Coaching Notes — Round ${session.roundId} (${session.sideKey})\n\n${promptsText}${feedbackSection}`;
}

/**
 * A filesystem-safe filename for a coaching-notes download, e.g.
 * `coaching-notes-round-4-aff.txt`, mirroring
 * `pre-round-briefing.ts#preRoundBriefingFilename`'s exact sanitization
 * rule (non-alphanumeric characters collapse to single hyphens).
 */
export function coachingNotesFilename(roundId: string, sideKey: string): string {
  const safeId = `${roundId}-${sideKey}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `coaching-notes-${safeId || "session"}.txt`;
}

/** Longest summary preview `coachingSessionNews` renders before truncating with an ellipsis. */
const NEWS_PREVIEW_LENGTH = 140;

/**
 * Renders a News Stream announcement line for a freshly generated coaching
 * session, mirroring `team-collaboration-mode.ts`'s
 * `buildSprintNoteAnnouncementText` (same preview length, same
 * "truncate the body, keep the byline" shape).
 */
function buildCoachingSessionAnnouncementText(session: CoachingSessionRecord): string {
  const summary = buildCoachingSummaryText(session.prompts);
  const preview =
    summary.length > NEWS_PREVIEW_LENGTH ? `${summary.slice(0, NEWS_PREVIEW_LENGTH).trimEnd()}…` : summary;
  return `Round ${session.roundId} (${session.sideKey}), ${session.prompts.length} prompt${session.prompts.length === 1 ? "" : "s"}: ${preview}`;
}

/**
 * Turns every persisted coaching session that carries a `createdAt` into a
 * News Stream `NewsItem` — see this module's fileoverview for why this
 * lives here rather than in `debate-card-search`'s `state/newsStream.ts`
 * alongside its sibling `...News()` functions. A session saved before
 * `createdAt` existed has none and is silently skipped rather than
 * backdated, mirroring `evidenceLibraryEntries.ts`'s `argumentLibraryNews()`
 * convention. Regenerating an existing round+side's session (via
 * `buildAndSaveCoachingSession`) stamps a fresh `createdAt`, since a
 * regenerated session is itself a new event worth surfacing again.
 */
export function coachingSessionNews(): NewsItem[] {
  return listCoachingSessions()
    .filter((session): session is CoachingSessionRecord & { createdAt: number } => session.createdAt !== undefined)
    .map((session) => ({
      id: `coaching-session-${session.roundId}-${session.sideKey}-${session.createdAt}`,
      category: "community" as const,
      title: `New coaching session generated for round ${session.roundId} (${session.sideKey})`,
      body: buildCoachingSessionAnnouncementText(session),
      timestamp: session.createdAt,
      href: "/coaching",
    }));
}

/** Display order for a comparison's per-kind rows, matching every panel's existing label order. */
const COMPARISON_KIND_ORDER: CoachingPromptKind[] = ["extension", "refutation", "collapse", "weighing"];

const COMPARISON_KIND_LABELS: Record<CoachingPromptKind, string> = {
  extension: "Extension",
  refutation: "Refutation",
  collapse: "Collapse",
  weighing: "Weighing",
};

function groupPromptsByKind(prompts: CoachingPrompt[]): Record<CoachingPromptKind, CoachingPrompt[]> {
  const grouped: Record<CoachingPromptKind, CoachingPrompt[]> = {
    extension: [],
    refutation: [],
    collapse: [],
    weighing: [],
  };
  for (const prompt of prompts) grouped[prompt.kind].push(prompt);
  return grouped;
}

/** One kind's prompts from each of the two compared sessions, for a side-by-side row. */
export type CoachingSessionComparisonRow = {
  kind: CoachingPromptKind;
  a: CoachingPrompt[];
  b: CoachingPrompt[];
};

export type CoachingSessionComparison = {
  a: CoachingSessionRecord;
  b: CoachingSessionRecord;
  rowsByKind: CoachingSessionComparisonRow[];
};

/**
 * Builds a side-by-side comparison of two already-persisted coaching
 * sessions — the "a side-by-side comparison across two rounds" follow-up
 * named under the "🎙️ AI Coach Mode" bullet in TODO.md. Groups each
 * session's prompts by kind (extension/refutation/collapse/weighing) so a
 * comparison view can render matching kinds next to each other regardless
 * of the order either session's prompts happen to be stored in. Works for
 * two sides of the same round (e.g. AFF vs. NEG) or two different rounds
 * equally well — no round/side relationship is assumed between `a` and `b`.
 */
export function buildCoachingSessionComparison(
  a: CoachingSessionRecord,
  b: CoachingSessionRecord,
): CoachingSessionComparison {
  const groupedA = groupPromptsByKind(a.prompts);
  const groupedB = groupPromptsByKind(b.prompts);
  return {
    a,
    b,
    rowsByKind: COMPARISON_KIND_ORDER.map((kind) => ({ kind, a: groupedA[kind], b: groupedB[kind] })),
  };
}

function renderComparisonColumn(prompts: CoachingPrompt[]): string {
  return prompts.length === 0 ? "  (none)" : prompts.map((prompt) => `  - ${prompt.prompt}`).join("\n");
}

/**
 * Renders a `CoachingSessionComparison` as a downloadable plain-text
 * document — one section per prompt kind, each showing both sessions'
 * prompts of that kind stacked underneath their own round+side label.
 * Mirrors `buildCoachingNotesText`'s heading shape.
 */
export function buildCoachingSessionComparisonText(comparison: CoachingSessionComparison): string {
  const { a, b, rowsByKind } = comparison;
  const labelA = `Round ${a.roundId} (${a.sideKey})`;
  const labelB = `Round ${b.roundId} (${b.sideKey})`;
  const sections = rowsByKind.map(
    (row) =>
      `### ${COMPARISON_KIND_LABELS[row.kind]}\n${labelA}:\n${renderComparisonColumn(row.a)}\n\n${labelB}:\n${renderComparisonColumn(row.b)}`,
  );
  return `Coaching Comparison — ${labelA} vs. ${labelB}\n\n${sections.join("\n\n")}`;
}

/**
 * A filesystem-safe filename for a comparison download, e.g.
 * `coaching-comparison-round-1-aff-vs-round-1-neg.txt`, mirroring
 * `coachingNotesFilename`'s exact sanitization rule.
 */
export function coachingSessionComparisonFilename(a: CoachingSessionRecord, b: CoachingSessionRecord): string {
  const safeId = `${a.roundId}-${a.sideKey}-vs-${b.roundId}-${b.sideKey}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `coaching-comparison-${safeId || "sessions"}.txt`;
}
