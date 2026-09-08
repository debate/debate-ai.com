/**
 * @fileoverview Persistent storage for `drill-generator.ts`'s generated
 * `Drill` sets, keyed by `roundId` — the "(c) persisting generated drills
 * per round" follow-up named in the "AI Drill Generator" bullet in TODO.md's
 * Research Crowdsourcing Organizer Features list. Stores drill sets in
 * localStorage, mirroring the existing
 * `preRoundBriefings.ts`/`judgeParadigmSelections.ts` persistence
 * convention.
 *
 * `aiScripts` is additive and optional (existing records without one stay
 * valid) — it holds `round/drill-script-client.ts`'s AI-generated practice
 * scripts, keyed by a drill's index in `drills`, once a caller has
 * generated one for that drill; see `saveDrillAiScript` below, closing
 * follow-up (b) named under the "📚 AI Drill Generator" bullet.
 *
 * `completedDrillIndexes` is likewise additive and optional — it tracks
 * which drills (by index in `drills`) the user has marked practiced, the
 * "completion tracking" follow-up named under the "📚 AI Drill Generator"
 * bullet. See `toggleDrillCompletion`/`getDrillSetCompletionStats` below.
 * This slice tracks completion locally; the "tying completion into the
 * separate `debate-card-search` Progress Unlocks tier system" half of that
 * same follow-up is now also done — see `state/drillProgressUnlocks.ts`,
 * which sums `getDrillSetCompletionStats` across every persisted record and
 * feeds the total into `debate-card-search`'s tier logic, rendered by
 * `panels/DrillSetsPanel.tsx`'s "Practice tier" card.
 *
 * `scheduledReviewAt` is likewise additive and optional — it holds a
 * per-drill "come back and practice this again on/after this day" reminder
 * date (`YYYY-MM-DD`, keyed by the drill's index in `drills`), the "drill
 * scheduling/reminders" follow-up named under the "📚 AI Drill Generator"
 * bullet. There's no scheduled-job/push-notification infrastructure in this
 * repo (the same known gap `streakLapseReminders.ts` documents), so a
 * "reminder" here means an in-app "due for review" badge shown by
 * `panels/DrillSetsPanel.tsx` once the scheduled day arrives, not a push
 * notification. See `scheduleDrillReview`/`isDrillReviewDue`/
 * `getDueDrillIndexes` below.
 *
 * `updatedAt` is likewise additive and optional — stamped on every mutating
 * call (`saveDrillSet`, `saveDrillAiScript`, `toggleDrillCompletion`,
 * `scheduleDrillReview`) with the current time. It exists to drive
 * `resolveDrillSetConflict`/`planDrillSetMerge` below, the "sharing the
 * 'Practice tier' status across devices for a signed-in user" follow-up
 * named in `docs/features/drill-sets.md`'s Known gaps — see
 * `hooks/useDrillSets.ts`, which uses it the same way
 * `hooks/useWordCountRounds.ts` uses `WordCountRoundRecord.updatedAt`.
 *
 * `buildDrillReviewCalendarEvents` below is the other half of idea #13's
 * ("Coaching Programs and Group Challenges") own follow-up in TODO.md ("A
 * calendar/schedule view across a program's drills, sprints, and
 * challenges") — the "drills" part that `debate-community`'s
 * `lib/coaching-program-calendar.ts` deliberately left out of its first
 * slice, since this package already depends on `debate-community` (for
 * Progress Unlocks tiers) and importing it back would be circular. Instead
 * this returns a dependency-free, caller-shaped event
 * (`dayKey`/`label`/`detail`) that the app/page layer resolves from the
 * current user's own `useDrillSets()` and feeds into
 * `buildCoachingProgramCalendarEvents`/`buildPersistedCoachingProgramCalendar`'s
 * `drillReviews` input — see
 * `apps/debate-ai.com/app/coaching-programs/CoachingProgramRosterAnalyticsWithDrills.tsx`.
 *
 * `buildContributorDrillCompletionStats` below closes the other Known-gaps
 * item that same doc names: the Roster Analytics table's own "it doesn't yet
 * fold in drill-completion rate or practice-round counts" follow-up. It joins
 * the same `roundId`-to-contributor mapping against this store's persisted
 * drill sets, dependency-free the same way, resolved by the same app/page
 * layer alongside a `roundContributorFlows.ts`-driven practice-round lookup
 * into a `memberDrillPracticeStatus` map — see that same file and
 * `docs/features/coaching-programs.md`'s "Per-member drill/practice-round
 * status" section.
 *
 * @module state/drillSets
 */

import type { Flow } from "debate-round/src/types/flow";
import { buildDrillSet, type Drill, type DrillKind } from "debate-round/src/flow/drill-generator";

export type DrillSetRecord = {
  roundId: string;
  /** The side the drills were generated for (see `buildDrillSet`). */
  sideKey: string;
  drills: Drill[];
  /** AI-generated practice scripts, keyed by the drill's index in `drills`. */
  aiScripts?: Record<number, string>;
  /** Indexes (into `drills`) of drills the user has marked practiced/completed. */
  completedDrillIndexes?: number[];
  /** Scheduled next-review day (`YYYY-MM-DD`), keyed by the drill's index in `drills`. */
  scheduledReviewAt?: Record<number, string>;
  /**
   * Stamped automatically by every mutating call (`saveDrillSet`,
   * `saveDrillAiScript`, `toggleDrillCompletion`, `scheduleDrillReview`) with
   * the current time. Optional so a record persisted before this field
   * existed still parses — such a record always loses a conflict to one that
   * does carry a timestamp, mirroring `WordCountRoundRecord.updatedAt`. See
   * `resolveDrillSetConflict` below.
   */
  updatedAt?: number;
};

/** A round's drill-completion progress — see `getDrillSetCompletionStats`. */
export type DrillSetCompletionStats = {
  completed: number;
  total: number;
  /** `completed / total`, or `0` when `total` is `0`. */
  ratio: number;
};

const STORAGE_KEY = "drillSets";

function readAll(): DrillSetRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DrillSetRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: DrillSetRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted drill set, across all rounds. */
export function listDrillSets(): DrillSetRecord[] {
  return readAll();
}

/** Looks up the persisted drill set for a round, if any. */
export function getDrillSet(roundId: string): DrillSetRecord | undefined {
  return readAll().find((record) => record.roundId === roundId);
}

/**
 * Saves a round's drill set, overwriting any existing record for that
 * `roundId`. Stamps `updatedAt` with the current time on every save, so
 * cross-device conflict resolution (`resolveDrillSetConflict`) can tell
 * which device saved most recently.
 */
export function saveDrillSet(record: DrillSetRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  const stamped: DrillSetRecord = { ...record, updatedAt: Date.now() };
  if (index === -1) {
    records.push(stamped);
  } else {
    records[index] = stamped;
  }
  writeAll(records);
}

/**
 * Adopts a drill set record as-is — e.g. one fetched from the account during
 * cross-device sync (`hooks/useDrillSets.ts`) — preserving its own
 * `updatedAt` rather than stamping a fresh one the way `saveDrillSet` does
 * for an interactive save. Overwrites any existing local record for the same
 * `roundId`, mirroring `adoptWordCountRound`.
 */
export function adoptDrillSet(record: DrillSetRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

export type DrillSetConflictResolution = "local" | "remote" | "none";

/**
 * Decides which of two devices' copies of the same `roundId` is newer, for
 * `hooks/useDrillSets.ts`'s account merge — mirrors
 * `resolveWordCountRoundConflict` exactly. A newer `updatedAt` wins; a
 * record with no `updatedAt` always loses to one that has it; when both are
 * missing or exactly equal, this returns `"none"` rather than guessing.
 */
export function resolveDrillSetConflict(
  local: DrillSetRecord,
  remote: DrillSetRecord,
): DrillSetConflictResolution {
  if (remote.updatedAt !== undefined && (local.updatedAt === undefined || remote.updatedAt > local.updatedAt)) {
    return "remote";
  }
  if (local.updatedAt !== undefined && (remote.updatedAt === undefined || local.updatedAt > remote.updatedAt)) {
    return "local";
  }
  return "none";
}

export type DrillSetMergePlan = {
  /** Records to adopt locally — new to this device, or the remote copy is newer per `resolveDrillSetConflict`. */
  adopt: DrillSetRecord[];
  /** Local records to best-effort push to the account — new to the account, or the local copy is newer. */
  pushLocal: DrillSetRecord[];
};

/**
 * Pure merge-planning step for `hooks/useDrillSets.ts`'s account merge,
 * extracted so it's directly testable without a hook/DOM harness — mirrors
 * `planWordCountRoundMerge` exactly, keyed by `roundId`.
 */
export function planDrillSetMerge(
  localRecords: DrillSetRecord[],
  remoteRecords: DrillSetRecord[],
): DrillSetMergePlan {
  const localById = new Map(localRecords.map((record) => [record.roundId, record]));
  const remoteIds = new Set(remoteRecords.map((record) => record.roundId));

  const adopt: DrillSetRecord[] = [];
  const pushLocal: DrillSetRecord[] = [];

  for (const remote of remoteRecords) {
    const local = localById.get(remote.roundId);
    if (!local) {
      adopt.push(remote);
      continue;
    }
    const resolution = resolveDrillSetConflict(local, remote);
    if (resolution === "remote") adopt.push(remote);
    else if (resolution === "local") pushLocal.push(local);
  }
  for (const local of localRecords) {
    if (!remoteIds.has(local.roundId)) pushLocal.push(local);
  }

  return { adopt, pushLocal };
}

/** Deletes a round's persisted drill set; a no-op if it isn't stored. */
export function deleteDrillSet(roundId: string): void {
  writeAll(readAll().filter((record) => record.roundId !== roundId));
}

/**
 * Sets a round's persisted `aiScripts[drillIndex]`
 * (`round/drill-script-client.ts`'s `requestDrillScript` result for that
 * drill), leaving `drills` and every other drill's script untouched. A
 * no-op when the roundId isn't stored — a script call is only ever made
 * against an already-generated, already-persisted drill set.
 */
export function saveDrillAiScript(roundId: string, drillIndex: number, aiScript: string): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === roundId);
  if (index === -1) return;
  const existing = records[index];
  records[index] = {
    ...existing,
    aiScripts: { ...(existing.aiScripts ?? {}), [drillIndex]: aiScript },
    updatedAt: Date.now(),
  };
  writeAll(records);
}

/**
 * Toggles whether a drill (by index in `drills`) is marked completed/
 * practiced, leaving `drills` and `aiScripts` untouched. A no-op when the
 * roundId isn't stored or `drillIndex` is out of range for that record's
 * `drills` — mirrors `saveDrillAiScript`'s guard, since a completion toggle
 * is only ever made against an already-generated, already-persisted drill.
 */
export function toggleDrillCompletion(roundId: string, drillIndex: number): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === roundId);
  if (index === -1) return;
  const existing = records[index];
  if (drillIndex < 0 || drillIndex >= existing.drills.length) return;
  const completed = new Set(existing.completedDrillIndexes ?? []);
  if (completed.has(drillIndex)) {
    completed.delete(drillIndex);
  } else {
    completed.add(drillIndex);
  }
  records[index] = {
    ...existing,
    completedDrillIndexes: [...completed].sort((a, b) => a - b),
    updatedAt: Date.now(),
  };
  writeAll(records);
}

/**
 * Schedules (or, passing `null`, clears) a drill's next-review reminder day
 * (`YYYY-MM-DD`), leaving `drills`/`aiScripts`/`completedDrillIndexes`
 * untouched. A no-op when the roundId isn't stored or `drillIndex` is out of
 * range for that record's `drills` — mirrors `saveDrillAiScript`/
 * `toggleDrillCompletion`'s guard.
 */
export function scheduleDrillReview(roundId: string, drillIndex: number, dayKey: string | null): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === roundId);
  if (index === -1) return;
  const existing = records[index];
  if (drillIndex < 0 || drillIndex >= existing.drills.length) return;
  const scheduledReviewAt = { ...(existing.scheduledReviewAt ?? {}) };
  if (dayKey) {
    scheduledReviewAt[drillIndex] = dayKey;
  } else {
    delete scheduledReviewAt[drillIndex];
  }
  records[index] = { ...existing, scheduledReviewAt, updatedAt: Date.now() };
  writeAll(records);
}

/**
 * Whether a drill's scheduled review day has arrived — `scheduledReviewAt`
 * is set and is on or before `todayKey` (both `YYYY-MM-DD`, so a plain
 * string comparison suffices). An unscheduled drill (`undefined`) is never
 * due.
 */
export function isDrillReviewDue(scheduledReviewAt: string | undefined, todayKey: string): boolean {
  return scheduledReviewAt !== undefined && scheduledReviewAt <= todayKey;
}

/**
 * Indexes (into `drills`) of a round's drills whose scheduled review day has
 * arrived, sorted ascending — what `panels/DrillSetsPanel.tsx` flags as
 * "due for review" today. Ignores a scheduled index that's out of range for
 * the record's current `drills` (defensive, mirrors
 * `getDrillSetCompletionStats`'s handling of stale indexes).
 */
export function getDueDrillIndexes(
  record: Pick<DrillSetRecord, "drills" | "scheduledReviewAt">,
  todayKey: string,
): number[] {
  const scheduled = record.scheduledReviewAt ?? {};
  return Object.keys(scheduled)
    .map(Number)
    .filter((drillIndex) => drillIndex >= 0 && drillIndex < record.drills.length)
    .filter((drillIndex) => isDrillReviewDue(scheduled[drillIndex], todayKey))
    .sort((a, b) => a - b);
}

/** One resolved drill-review reminder, shaped for `debate-community`'s calendar rather than this package's own types — see `buildDrillReviewCalendarEvents` below. */
export type DrillReviewCalendarEvent = {
  dayKey: string;
  label: string;
  detail?: string;
};

const DRILL_REVIEW_KIND_LABELS: Record<DrillKind, string> = {
  overview: "Overview",
  frontline: "Frontline",
  cross_ex: "Cross-Ex",
  collapse: "Collapse",
};

const DETAIL_PREVIEW_LENGTH = 80;

function truncateDrillPrompt(prompt: string): string {
  const trimmed = prompt.trim();
  return trimmed.length > DETAIL_PREVIEW_LENGTH ? `${trimmed.slice(0, DETAIL_PREVIEW_LENGTH).trimEnd()}…` : trimmed;
}

/**
 * Builds one calendar event per scheduled drill review across a set of
 * drill-set records, ignoring a scheduled index that's out of range for its
 * record's current `drills` (defensive, mirrors `getDueDrillIndexes`'s same
 * guard). Sorted chronologically (day ascending), then by label, matching
 * `buildCoachingProgramCalendarEvents`'s own sort. Pure — the caller
 * supplies whichever records it wants represented (typically the current
 * user's own, from `useDrillSets()`); this doesn't read persisted state
 * itself.
 */
export function buildDrillReviewCalendarEvents(
  records: Pick<DrillSetRecord, "roundId" | "drills" | "scheduledReviewAt">[],
): DrillReviewCalendarEvent[] {
  const events: DrillReviewCalendarEvent[] = [];
  for (const record of records) {
    const scheduled = record.scheduledReviewAt;
    if (!scheduled) continue;
    for (const [indexKey, dayKey] of Object.entries(scheduled)) {
      const drillIndex = Number(indexKey);
      const drill = record.drills[drillIndex];
      if (!drill) continue;
      events.push({
        dayKey,
        label: `Review a ${DRILL_REVIEW_KIND_LABELS[drill.kind]} drill for round ${record.roundId}`,
        detail: truncateDrillPrompt(drill.prompt),
      });
    }
  }
  return events.sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.label.localeCompare(b.label));
}

/**
 * A round's drill-completion progress — how many of its drills are marked
 * completed, out of the total, and the ratio (`0` when there are no
 * drills, matching `MeterBar`'s own `max <= 0` handling). Used by
 * `panels/DrillSetsPanel.tsx` to render a per-round progress meter.
 */
export function getDrillSetCompletionStats(record: Pick<DrillSetRecord, "drills" | "completedDrillIndexes">): DrillSetCompletionStats {
  const total = record.drills.length;
  const completed = (record.completedDrillIndexes ?? []).filter(
    (drillIndex) => drillIndex >= 0 && drillIndex < total,
  ).length;
  return { completed, total, ratio: total > 0 ? completed / total : 0 };
}

/**
 * Joins a coaching program roster's recorded practice-round flows —
 * `debate-team-collaboration`'s `state/roundContributorFlows.ts#listRoundContributorFlows`,
 * duck-typed here as `{ contributorId, roundId }` rather than imported (this
 * package isn't otherwise a dependent of `debate-team-collaboration`, and a
 * structural type avoids adding an edge just for two fields) — against this
 * store's own persisted drill sets by `roundId`, for the "drill-completion
 * rate" half of `docs/features/coaching-programs.md`'s Known gaps: the
 * Roster Analytics table only showed challenge standings and quest streaks,
 * even though the `roundId`-to-contributor mapping needed to look up each
 * member's drill-completion progress already exists. A member with no
 * recorded round, or whose recorded round has no persisted drill set here,
 * is simply absent from the result — mirrors `buildDrillReviewCalendarEvents`'s
 * "no data, no event" handling above. See
 * `apps/debate-ai.com/app/coaching-programs/CoachingProgramRosterAnalyticsWithDrills.tsx`,
 * the sole caller (same circular-dependency reason `buildDrillReviewCalendarEvents`
 * documents above).
 */
export function buildContributorDrillCompletionStats(
  contributorRoundIds: { contributorId: string; roundId: string }[],
  drillSetRecords: Pick<DrillSetRecord, "roundId" | "drills" | "completedDrillIndexes">[],
): Record<string, DrillSetCompletionStats> {
  const byRoundId = new Map(drillSetRecords.map((record) => [record.roundId, record]));
  const stats: Record<string, DrillSetCompletionStats> = {};
  for (const { contributorId, roundId } of contributorRoundIds) {
    const record = byRoundId.get(roundId);
    if (record) stats[contributorId] = getDrillSetCompletionStats(record);
  }
  return stats;
}

/**
 * Derives a round's drill set from an already-flowed `Flow` and persists it
 * in one step — the "generate a new drill set for a round" affordance named
 * in `docs/features/drill-sets.md`'s Known gaps. Lets a caller with a live
 * flow (e.g. the round workspace's currently selected flow) create a
 * `DrillSetRecord` without hand-building it, mirroring
 * `roundContributorFlows.ts`'s `buildAndSaveRoundContributorFlow`. Overwrites
 * any existing drill set for `roundId`, same as `saveDrillSet`. Returns the
 * persisted (`updatedAt`-stamped) record, not the pre-save draft, so a
 * caller (e.g. `hooks/useDrillSets.ts`) can push exactly what's now stored.
 */
export function buildAndSaveDrillSet(
  flow: Pick<Flow, "children" | "columns">,
  roundId: string,
  sideKey: string,
  options: { collapseLimit?: number } = {},
): DrillSetRecord {
  const record: DrillSetRecord = { roundId, sideKey, drills: buildDrillSet(flow, sideKey, options) };
  saveDrillSet(record);
  return getDrillSet(roundId)!;
}

/**
 * Every persisted drill set, sorted by `roundId` then `sideKey` for a
 * stable display order — the "(a) a drill-panel UI that reads/writes
 * through the persistence store" follow-up named under the "📚 AI Drill
 * Generator" bullet in TODO.md. Used by `panels/DrillSetsPanel.tsx`.
 */
export function buildDrillSetsPanelView(): DrillSetRecord[] {
  return [...listDrillSets()].sort(
    (a, b) => a.roundId.localeCompare(b.roundId) || a.sideKey.localeCompare(b.sideKey),
  );
}
