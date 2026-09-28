/**
 * @fileoverview Shared "recent cloud items" merge logic for the account
 * discoverability widgets that surface a signed-in user's cloud-saved data
 * across the D1-backed stores idea #17 named ("save flows docs and debates
 * in SQL and link to users" — TODO.md's Product Feature Ideas idea #17):
 * REASON editor `documents`, `saved_flows`, `saved_rounds`, (added alongside
 * the same idea's word-count-round history sync, TODO.md idea #2's
 * account-sync follow-up) `saved_word_count_rounds`, and — the third and
 * last of idea #17's three named data types, "debates" — `practice_vs_ai_debates`
 * (Practice vs AI, `/versus-ai`), already saved per-user but never listed
 * anywhere a returning user could browse it before `GET /api/vsbot/history`
 * was added for exactly that purpose.
 *
 * A sixth kind, video speech-outcome simulation runs, joined next:
 * `CachedSpeechOutcome` (`debate-videos`) gained a stable
 * `${videoId}::${speechKey}::${lens}` id and joined `debate-data-sync`'s
 * generic `TOOL_RECORD_COLLECTIONS` sync (as `speechOutcomeRuns`, backed by
 * `saved_tool_records`) so a signed-in user's runs follow them to another
 * device — but that only wired the sync, not discoverability: nothing added
 * it to this merge, so a run a user paid to generate stayed invisible here
 * even once it was safely in SQL and linked to their account.
 *
 * `apps/debate-ai.com`'s `app/tools/MySavedItems.tsx` widget previously
 * merged only documents and rounds inline — flows (the middle of the three
 * originally named data types) were never fetched or shown, so a user with
 * only saved flows saw an empty widget despite having cloud-saved data. This
 * module extracts that merge/sort/format logic into pure, unit-tested
 * functions so a widget can include every kind without duplicating the
 * "which kind maps to which route/label/timestamp-shape" logic per caller.
 * Word-count rounds are its own account-linked history (`/word-count`, see
 * `packages/debate-help-docs/content/docs/features/word-count-rounds.mdx`)
 * that was never surfaced here even after documents/flows/rounds were,
 * despite being exactly the same "SQL-backed round history, discoverable
 * from the tools page" shape as `saved_rounds`.
 *
 * A seventh kind, Practice Drills' generated drill sets (`/drills`), joined
 * next: `saved_drill_sets` already synced a signed-in user's `DrillSetRecord`s
 * (`debate-practice-drills`, keyed by `roundId`, same "no separate display
 * label" shape as {@link CloudWordCountRoundSummary}) per-user across
 * devices, but nothing surfaced that history here either — the same "sync
 * wired, discoverability not" gap {@link CloudSpeechOutcomeSummary} closed for
 * video speech-outcome runs.
 *
 * An eighth kind, AI Judge Decisions (`/judge-decision`), joined next:
 * `saved_judge_decisions` already synced a signed-in user's
 * `JudgeDecisionRecord`s (`debate-practice-drills`, one row per generated
 * decision, keyed by its own `id` rather than `roundId` since a round can
 * accumulate many decisions) via `GET /api/judge-decisions`, but the same
 * "sync wired, discoverability not" gap applied here too.
 *
 * A ninth kind, AI Response-Outcome Charts' counsel-panel assessments
 * (`/outcomes`), joined next: `saved_counsel_panel_assessments` already
 * synced a signed-in user's `CounselPanelAssessmentRecord`s
 * (`debate-practice-drills`, one row per generated assessment, keyed by its
 * own `id` rather than `roundId` for the same reason as judge decisions —
 * a round can accumulate many) via `GET /api/counsel-panel-assessments`, but
 * the same "sync wired, discoverability not" gap applied here too.
 *
 * A tenth kind, Pre-Round Briefings' saved round pairings (`/briefings`),
 * joined next: `saved_round_pairings` already synced a signed-in user's
 * `RoundPairingRecord`s (`debate-round` itself this time, one row per
 * pairing keyed by `roundId`) via `GET /api/round-pairings`, but the same
 * "sync wired, discoverability not" gap applied here too.
 *
 * An eleventh kind, Scout-to-Strategy's saved strategy recommendations
 * (`/strategy`), joined next: `saved_strategy_recommendations` already
 * synced a signed-in user's `StrategyRecommendationRecord`s (`debate-round`
 * itself, one row per built recommendation, many rows can share a
 * `matchupId`) via `GET /api/strategy-recommendations`, but the same "sync
 * wired, discoverability not" gap applied here too. Like counsel-panel
 * assessments, a recommendation carries no separate display name of its
 * own, so it's labeled by `matchupId`.
 *
 * A twelfth kind, Team Collaboration Mode's scheduled Topic Sprint sessions
 * (`/research`, `TopicSprintPanel`), joined next: `saved_sprint_sessions`
 * (`debate-team-collaboration`) already synced a signed-in user's
 * `SprintSession`s via `GET /api/sprint-sessions`, but the same "sync
 * wired, discoverability not" gap applied here too — a session scheduled on
 * one device stayed invisible from the tools page on another.
 *
 * A thirteenth kind, Speech Documents' send-log entries (`/speech-documents`,
 * CardMirror's "send to speech doc" history), joined next: `saved_speech_send_log`
 * (`debate-editor`) already synced a signed-in user's `SpeechSendLogEntry`s via
 * `GET /api/speech-send-log`, but the same "sync wired, discoverability not"
 * gap applied here too.
 *
 * A fourteenth kind, CardMirror Learn's custom flashcard decks
 * (`/reason-editor`), joined next: `saved_learn_decks` (`debate-editor`)
 * already synced a signed-in user's `CustomDeck`s via `GET /api/learn-decks`
 * (see `packages/debate-help-docs/content/docs/features/learn-decks-cloud-sync.mdx`),
 * but the same "sync wired, discoverability not [from the Tools page]" gap
 * applied here too — a deck built on one device stayed invisible from this
 * widget on another, discoverable only from inside the editor's own "Manage
 * flashcards" overlay.
 *
 * A fifteenth kind, Practice Round Simulator's saved custom opponent
 * personas (`/practice-round`), joined next: `saved_custom_opponent_personas`
 * (`apps/debate-ai.com`) already synced a signed-in user's
 * `SavedCustomOpponentPersona`s (`debate-speech-writer`'s
 * `opponent-persona-library.ts`, one row per saved persona) via
 * `GET /api/custom-opponent-personas`, but the same "sync wired,
 * discoverability not [from the Tools page]" gap applied here too — a
 * persona authored on one device stayed invisible from this widget on
 * another, discoverable only from inside the Practice Round Simulator's own
 * persona picker.
 *
 * A sixteenth kind, Flow Annotations' timestamped notes (`/annotations`),
 * joined next: `FlowAnnotation`s (`debate-round`'s own
 * `flow/flow-annotations.ts`, persisted by `debate-practice-drills`'
 * `state/flowAnnotations.ts`) already synced a signed-in user's annotations
 * via `debate-data-sync`'s generic `TOOL_RECORD_COLLECTIONS` mechanism (the
 * `flowAnnotations` collection, backed by `saved_tool_records` like
 * {@link CloudSpeechOutcomeSummary}), but the same "sync wired,
 * discoverability not" gap applied here too — an annotation dropped on one
 * device stayed invisible from this widget on another.
 *
 * A seventeenth kind, CardMirror's Quick Cards reusable-snippet library
 * (`/reason-editor`, same editor-internal home as documents and learn
 * decks), joined last: `QuickCard`s (`debate-editor`'s own
 * `editor/quick-cards-store.ts`) already synced a signed-in user's cards via
 * `GET /api/quick-cards` (`saved_quick_cards`, one row per card keyed by the
 * card's own `id` like {@link CloudLearnDeckSummary}), but the same "sync
 * wired, discoverability not [from the Tools page]" gap applied here too — a
 * card clipped on one device stayed invisible from this widget on another,
 * discoverable only from inside the editor's own quick-card search/manage UI.
 *
 * An eighteenth kind, Prep Notes' live per-argument notes (`/prep-notes`),
 * joined next: `PrepNote`s (`debate-round`'s own
 * `flow/strategy-sync-notes.ts`, persisted by `debate-team-collaboration`'s
 * `state/prepNotes.ts`) already synced a signed-in user's notes via
 * `debate-data-sync`'s generic `TOOL_RECORD_COLLECTIONS` mechanism (the
 * `prepNotes` collection, backed by `saved_tool_records` like
 * {@link CloudFlowAnnotationSummary}), but the same "sync wired,
 * discoverability not" gap applied here too — a note left on one device
 * stayed invisible from this widget on another.
 *
 * A nineteenth kind, the Evidence Library's cut cards and reusable analytic
 * blocks (`/cards/library`), joined last: an `EvidenceLibraryEntry`
 * (`debate-research-evidence`'s own `lib/shared-evidence-library.ts`,
 * persisted per-browser by `state/evidenceLibraryEntries.ts`, since — per
 * that module's own header comment — "the persisted `localStorage`
 * repository only sees entries saved in this one browser") already synced a
 * signed-in user's own submitted entries via `debate-data-sync`'s generic
 * `TOOL_RECORD_COLLECTIONS` mechanism (the `evidenceLibraryEntries`
 * collection, backed by `saved_tool_records` like
 * {@link CloudPrepNoteSummary}), but the same "sync wired, discoverability
 * not" gap applied here too — a card or block cut on one device stayed
 * invisible from this widget on another, discoverable only from inside the
 * Evidence Library's own search panel. Unlike the shared, server-backed
 * search index the same panel also queries, this is what one signed-in
 * user has personally submitted, so it fits this widget's existing "things
 * you saved" shape rather than the "bulk content library" shape earlier
 * entries below correctly excluded (e.g. `saved_tournament_results`,
 * admin-entered standings with no per-user submitter).
 *
 * Kept framework/fetch-free, matching `state/savedFlows.ts`/
 * `state/savedRounds.ts`'s split — `apps/debate-ai.com` has no vitest
 * project of its own (see `vitest.config.ts`'s `projects` list), so any
 * behavior worth testing here needs to live in a package that does.
 *
 * @module state/cloudLibrary
 */

import type { SavedFlowSummary } from "./savedFlows";
import type { SavedRoundSummary } from "./savedRounds";
import type { RoundPairingRecord } from "./roundPairings";
import type { StrategyRecommendationRecord } from "./strategyRecommendations";
import type { FlowAnnotation } from "../flow/flow-annotations";
import type { PrepNote } from "../flow/strategy-sync-notes";

/** The subset of `documents` a caller needs to list one in the merged view — mirrors `GET /api/doc/documents`'s row shape. */
export type CloudDocumentSummary = {
  id: number;
  title: string;
  updatedAt: string | number;
};

/**
 * The subset of a `WordCountRoundRecord` a caller needs to list one in the
 * merged view — mirrors `GET /api/word-count-rounds`'s row shape (full
 * records, not label-only summaries; see that route's own header comment).
 * There is no separate display label for a word-count round — it's keyed
 * and shown by its caller-typed `roundId` everywhere else in the app
 * (`WordCountRoundsPanel`), so this type doesn't carry one either.
 */
export type CloudWordCountRoundSummary = {
  roundId: string;
  createdAt?: number;
  updatedAt?: number;
};

/**
 * The subset of a `DebateVsBotRecord` (`debate-practice-vs-ai`) a caller
 * needs to list one in the merged view — mirrors `GET /api/vsbot/history`'s
 * `{ debates: [...] }` row shape. Defined locally rather than importing
 * `DebateVsBotRecord` itself, matching {@link CloudWordCountRoundSummary}'s
 * own local-type convention: `debate-round` doesn't depend on
 * `debate-practice-vs-ai` (nor the reverse), so pulling in its types here
 * would add a dependency edge this module doesn't otherwise need.
 */
export type CloudDebateSummary = {
  id: string;
  topic: string;
  /** Unix seconds, per `DebateVsBotRecord.createdAt` — there is no separate `updatedAt`. */
  createdAt: number;
};

/**
 * The subset of a `CachedSpeechOutcome` (`debate-videos`) a caller needs to
 * list one in the merged view — mirrors `GET /api/tool-records/speechOutcomeRuns`'s
 * row shape (full records, like {@link CloudWordCountRoundSummary}; the
 * generic tool-records route has no label-only summary mode). Defined
 * locally rather than importing `CachedSpeechOutcome` itself, matching
 * {@link CloudDebateSummary}'s own local-type convention: `debate-round`
 * doesn't depend on `debate-videos` (nor the reverse).
 */
export type CloudSpeechOutcomeSummary = {
  id: string;
  speechKey: string;
  /** Epoch milliseconds, per `CachedSpeechOutcome.savedAt` — there is no separate `updatedAt`. */
  savedAt: number;
};

/**
 * The subset of a `DrillSetRecord` (`debate-practice-drills`) a caller needs
 * to list one in the merged view — mirrors `GET /api/drill-sets`'s row shape
 * (full records, like {@link CloudWordCountRoundSummary}; the drill-sets
 * route has no label-only summary mode either). Defined locally rather than
 * importing `DrillSetRecord` itself, matching {@link CloudDebateSummary}'s
 * own local-type convention: `debate-round` doesn't depend on
 * `debate-practice-drills` (nor the reverse).
 */
export type CloudDrillSetSummary = {
  roundId: string;
  /** Epoch milliseconds, per `DrillSetRecord.updatedAt` — optional, since a record saved before that field existed still parses. */
  updatedAt?: number;
};

/**
 * The subset of a `JudgeDecisionRecord` (`debate-practice-drills`) a caller
 * needs to list one in the merged view — mirrors `GET /api/judge-decisions`'s
 * row shape (full records, like {@link CloudWordCountRoundSummary}; the
 * judge-decisions route has no label-only summary mode either). Defined
 * locally rather than importing `JudgeDecisionRecord` itself, matching
 * {@link CloudDrillSetSummary}'s own local-type convention: `debate-round`
 * doesn't depend on `debate-practice-drills` (nor the reverse).
 */
export type CloudJudgeDecisionSummary = {
  id: string;
  paradigmName: string;
  /** Epoch milliseconds, per `JudgeDecisionRecord.generatedAt` — there is no separate `updatedAt`. */
  generatedAt: number;
};

/**
 * The subset of a `CounselPanelAssessmentRecord` (`debate-practice-drills`)
 * a caller needs to list one in the merged view — mirrors
 * `GET /api/counsel-panel-assessments`'s row shape (full records, like
 * {@link CloudJudgeDecisionSummary}; the counsel-panel-assessments route has
 * no label-only summary mode either). Defined locally rather than importing
 * `CounselPanelAssessmentRecord` itself, matching {@link CloudJudgeDecisionSummary}'s
 * own local-type convention: `debate-round` doesn't depend on
 * `debate-practice-drills` (nor the reverse). Unlike a judge decision, an
 * assessment carries no separate display name (the panel's result is a
 * clash summary plus per-argument scores, not a single title) — it's keyed
 * and shown by its `roundId` everywhere else in the app
 * (`VulnerabilityChartsPanel`'s history log), so this type is labeled by
 * `roundId` like {@link CloudDrillSetSummary} rather than by a name field.
 */
export type CloudCounselPanelAssessmentSummary = {
  id: string;
  roundId: string;
  /** Epoch milliseconds, per `CounselPanelAssessmentRecord.generatedAt` — there is no separate `updatedAt`. */
  generatedAt: number;
};

/**
 * The subset of a `RoundPairingRecord` (`debate-round`) a caller needs to
 * list one in the merged view — mirrors `GET /api/round-pairings`'s row
 * shape (full records, like {@link CloudDrillSetSummary}; the round-pairings
 * route has no label-only summary mode either). Imported directly rather
 * than defined locally like the other in-package summary types above: this
 * one already lives in `debate-round` itself (`state/roundPairings.ts`), so
 * there's no cross-package dependency edge to avoid.
 */
export type CloudRoundPairingSummary = Pick<
  RoundPairingRecord,
  "roundId" | "tournamentName" | "roundLabel" | "updatedAt"
>;

/**
 * The subset of a `StrategyRecommendationRecord` (`debate-round`) a caller
 * needs to list one in the merged view — mirrors `GET /api/strategy-recommendations`'s
 * row shape (full records, like {@link CloudCounselPanelAssessmentSummary};
 * the strategy-recommendations route has no label-only summary mode
 * either). Imported directly rather than defined locally, matching
 * {@link CloudRoundPairingSummary}'s own in-package convention — this type
 * already lives in `debate-round` itself (`state/strategyRecommendations.ts`).
 * Like a counsel-panel assessment, a recommendation carries no separate
 * display name — it's keyed and shown by its own `id` and grouped by
 * `matchupId` everywhere else in the app (`StrategyPanel`'s history log), so
 * this type is labeled by `matchupId` like {@link CloudCounselPanelAssessmentSummary}
 * rather than by a name field.
 */
export type CloudStrategyRecommendationSummary = Pick<
  StrategyRecommendationRecord,
  "id" | "matchupId" | "generatedAt"
>;

/**
 * The subset of a `SprintSession` (`debate-team-collaboration`) a caller
 * needs to list one in the merged view — mirrors `GET /api/sprint-sessions`'s
 * row shape (full records, like {@link CloudDrillSetSummary}; the
 * sprint-sessions route has no label-only summary mode either). Defined
 * locally rather than importing `SprintSession` itself, matching
 * {@link CloudDebateSummary}'s own local-type convention: `debate-round`
 * doesn't depend on `debate-team-collaboration` (nor the reverse).
 */
export type CloudSprintSessionSummary = {
  id: string;
  topic: string;
  title: string;
  /** Epoch milliseconds, per `SprintSession.createdAt` — there is no separate `updatedAt`. */
  createdAt: number;
};

/**
 * The subset of a `SpeechSendLogEntry` (`debate-editor`) a caller needs to
 * list one in the merged view — mirrors `GET /api/speech-send-log`'s row
 * shape (full records, like {@link CloudDrillSetSummary}; the
 * speech-send-log route has no label-only summary mode either). Defined
 * locally rather than importing `SpeechSendLogEntry` itself, matching
 * {@link CloudDebateSummary}'s own local-type convention: `debate-round`
 * doesn't depend on `debate-editor` (nor the reverse).
 */
export type CloudSpeechSendLogSummary = {
  id: string;
  preview: string;
  sentAt: number;
};

/**
 * The subset of a `CustomDeck` (`debate-editor`) a caller needs to list one
 * in the merged view — mirrors `GET /api/learn-decks`'s row shape (full
 * records, like {@link CloudSpeechSendLogSummary}; the learn-decks route has
 * no label-only summary mode either). Defined locally rather than importing
 * `CustomDeck` itself, matching {@link CloudDebateSummary}'s own local-type
 * convention: `debate-round` doesn't depend on `debate-editor` for this
 * purpose (see `state/cloudLibraryClient.ts`'s raw-`fetch` convention for the
 * same reasoning).
 */
export type CloudLearnDeckSummary = {
  deckId: string;
  name: string;
  /** ISO date string, per `CustomDeck.createdAt` — there is no separate `updatedAt`. */
  createdAt: string;
};

/**
 * The subset of a `SavedCustomOpponentPersona` (`debate-speech-writer`) a
 * caller needs to list one in the merged view — mirrors
 * `GET /api/custom-opponent-personas`'s row shape (full records, like
 * {@link CloudLearnDeckSummary}; the custom-opponent-personas route has no
 * label-only summary mode either). Defined locally rather than importing
 * `SavedCustomOpponentPersona` itself, matching {@link CloudDebateSummary}'s
 * own local-type convention: `debate-round` doesn't depend on
 * `debate-speech-writer` (nor the reverse).
 */
export type CloudCustomOpponentPersonaSummary = {
  id: string;
  name: string;
  /** Epoch milliseconds, per `SavedCustomOpponentPersona.updatedAt`. */
  updatedAt: number;
};

/**
 * The subset of a `FlowAnnotation` (`debate-round`'s own
 * `flow/flow-annotations.ts`) a caller needs to list one in the merged
 * view — mirrors `GET /api/tool-records/flowAnnotations`'s row shape (full
 * records, like {@link CloudSpeechOutcomeSummary}; the generic tool-records
 * route has no label-only summary mode). Imported directly rather than
 * defined locally like the cross-package summary types above: `FlowAnnotation`
 * already lives in this package (`flow/flow-annotations.ts`), so there's no
 * dependency edge to avoid.
 */
export type CloudFlowAnnotationSummary = Pick<FlowAnnotation, "id" | "note" | "tag" | "createdAt">;

/**
 * The subset of a `QuickCard` (`debate-editor`) a caller needs to list one in
 * the merged view — mirrors `GET /api/quick-cards`'s row shape (full
 * records, like {@link CloudLearnDeckSummary}; the quick-cards route has no
 * label-only summary mode either). Defined locally rather than importing
 * `QuickCard` itself, matching {@link CloudLearnDeckSummary}'s own
 * local-type convention: `debate-round` doesn't depend on `debate-editor`
 * (nor the reverse).
 */
export type CloudQuickCardSummary = {
  id: string;
  name: string;
  updatedAt: number;
};

/**
 * The subset of a `PrepNote` (`debate-round`'s own
 * `flow/strategy-sync-notes.ts`) a caller needs to list one in the merged
 * view — mirrors `GET /api/tool-records/prepNotes`'s row shape (full
 * records, like {@link CloudFlowAnnotationSummary}; the generic tool-records
 * route has no label-only summary mode). Imported directly rather than
 * defined locally, matching {@link CloudFlowAnnotationSummary}'s own
 * convention: `PrepNote` already lives in this package, so there's no
 * dependency edge to avoid.
 */
export type CloudPrepNoteSummary = Pick<PrepNote, "id" | "text" | "updatedAt">;

/**
 * The subset of an `EvidenceLibraryEntry` (`debate-research-evidence`) a
 * caller needs to list one in the merged view — mirrors
 * `GET /api/tool-records/evidenceLibraryEntries`'s row shape (full records,
 * like {@link CloudFlowAnnotationSummary}; the generic tool-records route has
 * no label-only summary mode). Defined locally rather than importing
 * `EvidenceLibraryEntry` itself, matching {@link CloudLearnDeckSummary}'s own
 * local-type convention: this type mirrors the wire shape rather than that
 * package's own internal type. `cite` is blank for a `block`-kind entry (see
 * that type's own doc comment), so `argBlock` is this type's fallback label
 * field, and `createdAt` is optional since an entry persisted before that
 * field existed still parses.
 */
export type CloudEvidenceLibraryEntrySummary = {
  id: string;
  cite: string;
  argBlock: string;
  createdAt?: number;
};

export type CloudLibraryItemKind =
  | "document"
  | "flow"
  | "round"
  | "wordCountRound"
  | "debate"
  | "speechOutcome"
  | "drillSet"
  | "judgeDecision"
  | "counselPanelAssessment"
  | "roundPairing"
  | "strategyRecommendation"
  | "sprintSession"
  | "speechSendLogEntry"
  | "learnDeck"
  | "customOpponentPersona"
  | "flowAnnotation"
  | "quickCard"
  | "prepNote"
  | "evidenceLibraryEntry";

export interface CloudLibraryItem {
  kind: CloudLibraryItemKind;
  /** Stable React key: `${kind}-${id}`. */
  key: string;
  href: string;
  label: string;
  /** Milliseconds since epoch, normalized from whatever timestamp shape the source row used. */
  updatedAtMs: number;
}

/**
 * Normalizes a timestamp that may arrive as an ISO date string (documents/
 * flows/rounds all serialize their drizzle `timestamp`-mode columns this
 * way through `NextResponse.json`) or as a raw number in either seconds or
 * milliseconds (a defensive fallback for a caller passing a raw D1
 * `unixepoch()` value directly) into milliseconds since epoch. Returns `0`
 * for anything unparseable so a malformed row sorts last rather than
 * throwing.
 */
export function parseCloudTimestamp(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    // A unix-seconds value is at most ~13 digits shorter than the
    // millisecond epoch would be for any date in this app's lifetime;
    // 1e12 ms is September 2001, well before any real row's timestamp, so
    // anything smaller is assumed to be seconds.
    return value < 1e12 ? value * 1000 : value;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

export interface BuildRecentCloudItemsInput {
  documents?: CloudDocumentSummary[];
  flows?: SavedFlowSummary[];
  rounds?: SavedRoundSummary[];
  wordCountRounds?: CloudWordCountRoundSummary[];
  debates?: CloudDebateSummary[];
  speechOutcomes?: CloudSpeechOutcomeSummary[];
  drillSets?: CloudDrillSetSummary[];
  judgeDecisions?: CloudJudgeDecisionSummary[];
  counselPanelAssessments?: CloudCounselPanelAssessmentSummary[];
  roundPairings?: CloudRoundPairingSummary[];
  strategyRecommendations?: CloudStrategyRecommendationSummary[];
  sprintSessions?: CloudSprintSessionSummary[];
  speechSendLogEntries?: CloudSpeechSendLogSummary[];
  learnDecks?: CloudLearnDeckSummary[];
  customOpponentPersonas?: CloudCustomOpponentPersonaSummary[];
  flowAnnotations?: CloudFlowAnnotationSummary[];
  quickCards?: CloudQuickCardSummary[];
  prepNotes?: CloudPrepNoteSummary[];
  evidenceLibraryEntries?: CloudEvidenceLibraryEntrySummary[];
}

export interface BuildRecentCloudItemsOptions {
  /** Max items in the merged, sorted result. Default 6. */
  limit?: number;
  /** Max items taken from each kind before merging, so one prolific kind can't crowd out the others entirely. Default 5. */
  perKindLimit?: number;
  documentHref?: string;
  flowHref?: string;
  roundHref?: string;
  wordCountRoundHref?: string;
  debateHref?: string;
  speechOutcomeHref?: string;
  drillSetHref?: string;
  judgeDecisionHref?: string;
  counselPanelAssessmentHref?: string;
  roundPairingHref?: string;
  strategyRecommendationHref?: string;
  sprintSessionHref?: string;
  speechSendLogEntryHref?: string;
  learnDeckHref?: string;
  customOpponentPersonaHref?: string;
  flowAnnotationHref?: string;
  quickCardHref?: string;
  prepNoteHref?: string;
  evidenceLibraryEntryHref?: string;
}

/**
 * Merges documents/flows/rounds summaries into one list, newest-first,
 * capped to `opts.limit`. Each kind is independently capped to
 * `opts.perKindLimit` first (mirroring the original inline widget logic)
 * so, e.g., 20 recently-saved flows can't push every document and round out
 * of the merged result before the final sort/slice even runs.
 */
export function buildRecentCloudItems(
  input: BuildRecentCloudItemsInput,
  opts: BuildRecentCloudItemsOptions = {},
): CloudLibraryItem[] {
  const {
    limit = 6,
    perKindLimit = 5,
    documentHref = "/reason-editor",
    flowHref = "/debate",
    roundHref = "/debate",
    wordCountRoundHref = "/word-count",
    debateHref = "/versus-ai",
    speechOutcomeHref = "/videos",
    drillSetHref = "/drills",
    judgeDecisionHref = "/judge-decision",
    counselPanelAssessmentHref = "/outcomes",
    roundPairingHref = "/briefings",
    strategyRecommendationHref = "/strategy",
    sprintSessionHref = "/research",
    speechSendLogEntryHref = "/speech-documents",
    learnDeckHref = "/reason-editor",
    customOpponentPersonaHref = "/practice-round",
    flowAnnotationHref = "/annotations",
    quickCardHref = "/reason-editor",
    prepNoteHref = "/prep-notes",
    evidenceLibraryEntryHref = "/cards/library",
  } = opts;

  const documentItems: CloudLibraryItem[] = (input.documents ?? []).slice(0, perKindLimit).map((doc) => ({
    kind: "document",
    key: `document-${doc.id}`,
    href: documentHref,
    label: doc.title.trim() || "Untitled",
    updatedAtMs: parseCloudTimestamp(doc.updatedAt),
  }));

  const flowItems: CloudLibraryItem[] = (input.flows ?? []).slice(0, perKindLimit).map((flow) => ({
    kind: "flow",
    key: `flow-${flow.clientId}`,
    href: flowHref,
    label: flow.label.trim() || "Untitled flow",
    updatedAtMs: parseCloudTimestamp(flow.updatedAt),
  }));

  const roundItems: CloudLibraryItem[] = (input.rounds ?? []).slice(0, perKindLimit).map((round) => ({
    kind: "round",
    key: `round-${round.clientId}`,
    href: roundHref,
    label: round.label.trim() || "Untitled round",
    updatedAtMs: parseCloudTimestamp(round.updatedAt),
  }));

  const wordCountRoundItems: CloudLibraryItem[] = (input.wordCountRounds ?? [])
    .slice(0, perKindLimit)
    .map((round) => ({
      kind: "wordCountRound",
      key: `wordCountRound-${round.roundId}`,
      href: wordCountRoundHref,
      label: round.roundId.trim() || "Untitled round",
      updatedAtMs: parseCloudTimestamp(round.updatedAt ?? round.createdAt ?? 0),
    }));

  const debateItems: CloudLibraryItem[] = (input.debates ?? []).slice(0, perKindLimit).map((debate) => ({
    kind: "debate",
    key: `debate-${debate.id}`,
    href: debateHref,
    label: debate.topic.trim() || "Untitled debate",
    updatedAtMs: parseCloudTimestamp(debate.createdAt),
  }));

  const speechOutcomeItems: CloudLibraryItem[] = (input.speechOutcomes ?? [])
    .slice(0, perKindLimit)
    .map((run) => ({
      kind: "speechOutcome",
      key: `speechOutcome-${run.id}`,
      href: speechOutcomeHref,
      label: run.speechKey.trim() ? `${run.speechKey.trim()} Outcome` : "Untitled speech outcome",
      updatedAtMs: parseCloudTimestamp(run.savedAt),
    }));

  const drillSetItems: CloudLibraryItem[] = (input.drillSets ?? [])
    .slice(0, perKindLimit)
    .map((drillSet) => ({
      kind: "drillSet",
      key: `drillSet-${drillSet.roundId}`,
      href: drillSetHref,
      label: drillSet.roundId.trim() || "Untitled drill set",
      updatedAtMs: parseCloudTimestamp(drillSet.updatedAt ?? 0),
    }));

  const judgeDecisionItems: CloudLibraryItem[] = (input.judgeDecisions ?? [])
    .slice(0, perKindLimit)
    .map((decision) => ({
      kind: "judgeDecision",
      key: `judgeDecision-${decision.id}`,
      href: judgeDecisionHref,
      label: decision.paradigmName.trim() ? `${decision.paradigmName.trim()} Decision` : "Untitled judge decision",
      updatedAtMs: parseCloudTimestamp(decision.generatedAt),
    }));

  const counselPanelAssessmentItems: CloudLibraryItem[] = (input.counselPanelAssessments ?? [])
    .slice(0, perKindLimit)
    .map((assessment) => ({
      kind: "counselPanelAssessment",
      key: `counselPanelAssessment-${assessment.id}`,
      href: counselPanelAssessmentHref,
      label: assessment.roundId.trim() || "Untitled response-outcome chart",
      updatedAtMs: parseCloudTimestamp(assessment.generatedAt),
    }));

  const roundPairingItems: CloudLibraryItem[] = (input.roundPairings ?? [])
    .slice(0, perKindLimit)
    .map((pairing) => {
      const tournamentName = pairing.tournamentName.trim();
      const roundLabel = pairing.roundLabel.trim();
      const label = tournamentName && roundLabel
        ? `${tournamentName} — ${roundLabel}`
        : tournamentName || roundLabel || "Untitled pairing";
      return {
        kind: "roundPairing" as const,
        key: `roundPairing-${pairing.roundId}`,
        href: roundPairingHref,
        label,
        updatedAtMs: parseCloudTimestamp(pairing.updatedAt ?? 0),
      };
    });

  const strategyRecommendationItems: CloudLibraryItem[] = (input.strategyRecommendations ?? [])
    .slice(0, perKindLimit)
    .map((recommendation) => ({
      kind: "strategyRecommendation" as const,
      key: `strategyRecommendation-${recommendation.id}`,
      href: strategyRecommendationHref,
      label: recommendation.matchupId.trim() || "Untitled strategy recommendation",
      updatedAtMs: parseCloudTimestamp(recommendation.generatedAt),
    }));

  const sprintSessionItems: CloudLibraryItem[] = (input.sprintSessions ?? [])
    .slice(0, perKindLimit)
    .map((session) => ({
      kind: "sprintSession" as const,
      key: `sprintSession-${session.id}`,
      href: sprintSessionHref,
      label: session.title.trim() || session.topic.trim() || "Untitled sprint session",
      updatedAtMs: parseCloudTimestamp(session.createdAt),
    }));

  const speechSendLogItems: CloudLibraryItem[] = (input.speechSendLogEntries ?? [])
    .slice(0, perKindLimit)
    .map((entry) => ({
      kind: "speechSendLogEntry" as const,
      key: `speechSendLogEntry-${entry.id}`,
      href: speechSendLogEntryHref,
      label: entry.preview.trim() || "Untitled speech send",
      updatedAtMs: parseCloudTimestamp(entry.sentAt),
    }));

  const learnDeckItems: CloudLibraryItem[] = (input.learnDecks ?? [])
    .slice(0, perKindLimit)
    .map((deck) => ({
      kind: "learnDeck" as const,
      key: `learnDeck-${deck.deckId}`,
      href: learnDeckHref,
      label: deck.name.trim() || "Untitled deck",
      updatedAtMs: parseCloudTimestamp(deck.createdAt),
    }));

  const customOpponentPersonaItems: CloudLibraryItem[] = (input.customOpponentPersonas ?? [])
    .slice(0, perKindLimit)
    .map((persona) => ({
      kind: "customOpponentPersona" as const,
      key: `customOpponentPersona-${persona.id}`,
      href: customOpponentPersonaHref,
      label: persona.name.trim() || "Untitled persona",
      updatedAtMs: parseCloudTimestamp(persona.updatedAt),
    }));

  const flowAnnotationItems: CloudLibraryItem[] = (input.flowAnnotations ?? [])
    .slice(0, perKindLimit)
    .map((annotation) => ({
      kind: "flowAnnotation" as const,
      key: `flowAnnotation-${annotation.id}`,
      href: flowAnnotationHref,
      label: annotation.note?.trim() || annotation.tag?.trim() || "Untitled annotation",
      updatedAtMs: parseCloudTimestamp(annotation.createdAt),
    }));

  const quickCardItems: CloudLibraryItem[] = (input.quickCards ?? [])
    .slice(0, perKindLimit)
    .map((card) => ({
      kind: "quickCard" as const,
      key: `quickCard-${card.id}`,
      href: quickCardHref,
      label: card.name.trim() || "Untitled quick card",
      updatedAtMs: parseCloudTimestamp(card.updatedAt),
    }));

  const prepNoteItems: CloudLibraryItem[] = (input.prepNotes ?? [])
    .slice(0, perKindLimit)
    .map((note) => ({
      kind: "prepNote" as const,
      key: `prepNote-${note.id}`,
      href: prepNoteHref,
      label: note.text?.trim() || "Untitled prep note",
      updatedAtMs: parseCloudTimestamp(note.updatedAt),
    }));

  const evidenceLibraryEntryItems: CloudLibraryItem[] = (input.evidenceLibraryEntries ?? [])
    .slice(0, perKindLimit)
    .map((entry) => ({
      kind: "evidenceLibraryEntry" as const,
      key: `evidenceLibraryEntry-${entry.id}`,
      href: evidenceLibraryEntryHref,
      label: entry.cite?.trim() || entry.argBlock?.trim() || "Untitled evidence entry",
      updatedAtMs: parseCloudTimestamp(entry.createdAt ?? 0),
    }));

  return [
    ...documentItems,
    ...flowItems,
    ...roundItems,
    ...wordCountRoundItems,
    ...debateItems,
    ...speechOutcomeItems,
    ...drillSetItems,
    ...judgeDecisionItems,
    ...counselPanelAssessmentItems,
    ...roundPairingItems,
    ...strategyRecommendationItems,
    ...sprintSessionItems,
    ...speechSendLogItems,
    ...learnDeckItems,
    ...customOpponentPersonaItems,
    ...flowAnnotationItems,
    ...quickCardItems,
    ...prepNoteItems,
    ...evidenceLibraryEntryItems,
  ]
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    .slice(0, limit);
}

/**
 * Formats a millisecond timestamp as "Today" / "Yesterday" / "Nd ago",
 * matching the original inline widget's relative-time copy. `now` is
 * injectable so callers (and tests) don't depend on the wall clock.
 */
export function formatRelativeCloudTime(updatedAtMs: number, now: number = Date.now()): string {
  if (!Number.isFinite(updatedAtMs)) return "";
  const days = Math.floor((now - updatedAtMs) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}
