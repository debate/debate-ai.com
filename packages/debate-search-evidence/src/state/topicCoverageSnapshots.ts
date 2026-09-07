/**
 * @fileoverview Persistent storage for a topic's coverage-over-time trend —
 * the "a coverage-over-time trend chart" follow-up named under the "📊 Topic
 * Coverage Dashboard" bullet in TODO.md. A snapshot is a point-in-time tally
 * of a topic's tracked-argument coverage counts (missing/thin/covered/total),
 * recorded on demand from the dashboard (this repo has no background-job
 * infrastructure to snapshot on a schedule) via {@link recordCoverageSnapshot},
 * so a team can see whether a topic's coverage is trending up or down across
 * however often they choose to check in. Stores records in localStorage,
 * mirroring `reuseCheckHistory.ts`'s append-only-with-cap convention
 * (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
 * rather than throwing) — capped per-topic rather than globally, since one
 * team's history for a heavily-tracked topic shouldn't crowd out another
 * topic's.
 *
 * @module state/topicCoverageSnapshots
 */

import { computeCoverageCounts, type TopicCoverageReport } from "../lib/topic-coverage";

/** One recorded point-in-time coverage tally for a topic. */
export type TopicCoverageSnapshotRecord = {
  /** Generated once when the snapshot is recorded; the record's stable identity. */
  id: string;
  topic: string;
  createdAt: number;
  missing: number;
  thin: number;
  covered: number;
  total: number;
};

const STORAGE_KEY = "topicCoverageSnapshots";

/**
 * Once a topic's snapshot history exceeds this many entries, the oldest ones
 * beyond the cap are trimmed away, mirroring `reuseCheckHistory.ts`'s
 * `MAX_REUSE_CHECK_HISTORY` cap-constant convention.
 */
export const MAX_COVERAGE_SNAPSHOTS_PER_TOPIC = 50;

function readAll(): TopicCoverageSnapshotRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TopicCoverageSnapshotRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: TopicCoverageSnapshotRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function generateCoverageSnapshotId(): string {
  return `coverage-snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Every persisted snapshot for one topic, oldest first (the order a trend chart/list renders in). */
export function listCoverageSnapshots(topic: string): TopicCoverageSnapshotRecord[] {
  return readAll()
    .filter((record) => record.topic === topic)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Records a fresh snapshot of `report`'s coverage counts for `topic`,
 * assigning it a generated `id`. Once that topic's history exceeds
 * {@link MAX_COVERAGE_SNAPSHOTS_PER_TOPIC} entries, the oldest ones beyond the
 * cap are trimmed away — other topics' histories are untouched.
 */
export function recordCoverageSnapshot(
  topic: string,
  report: TopicCoverageReport,
  createdAt: number = Date.now(),
): TopicCoverageSnapshotRecord {
  const counts = computeCoverageCounts(report);
  const record: TopicCoverageSnapshotRecord = { id: generateCoverageSnapshotId(), topic, createdAt, ...counts };

  const others = readAll().filter((existing) => existing.topic !== topic);
  const thisTopic = [...listCoverageSnapshots(topic), record].slice(-MAX_COVERAGE_SNAPSHOTS_PER_TOPIC);
  writeAll([...others, ...thisTopic]);
  return record;
}

/** Clears every persisted snapshot for one topic; other topics' histories are untouched. */
export function clearCoverageSnapshots(topic: string): void {
  writeAll(readAll().filter((record) => record.topic !== topic));
}
