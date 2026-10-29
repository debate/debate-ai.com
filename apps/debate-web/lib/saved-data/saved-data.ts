import { count, eq } from "drizzle-orm";
import { findToolRecordCollection } from "@debate-ai/research-evidence/src/account-sync/toolRecordCollections";
import type { getDBFromContext } from "@/lib/database/context";
import { savedToolRecords } from "../database/schema";
import { loadUserUsage, type UsageKey } from "../admin/user-usage";

type AccountDB = Awaited<ReturnType<typeof getDBFromContext>>;

/**
 * What a signed-in user sees under Settings → "Saved to your account": the
 * work kinds that live in SQL rows linked to their user id. Order is the
 * order shown; `videosWatched` is deliberately left out (history, not work).
 */
const SAVED_DATA_KINDS: ReadonlyArray<{ key: UsageKey; label: string }> = [
  { key: "docs", label: "Documents" },
  { key: "flows", label: "Flows" },
  { key: "rounds", label: "Rounds" },
  { key: "wordCountRounds", label: "Word-count rounds" },
  { key: "practiceRounds", label: "Practice debates vs AI" },
  { key: "judgeDecisions", label: "Judge decisions" },
  { key: "speeches", label: "Sent speeches" },
  { key: "drills", label: "Drill sets" },
];

export interface SavedDataItem {
  key: UsageKey;
  label: string;
  count: number;
}

/** One synced tool-record collection (shortcuts, pinned debates…) with saved rows. */
export interface SavedToolCollection {
  collection: string;
  label: string;
  count: number;
}

export interface SavedDataSummary {
  items: SavedDataItem[];
  /** Tool-record collections that hold at least one row, largest first. */
  tools: SavedToolCollection[];
  total: number;
}

/**
 * Per-collection row counts from `saved_tool_records` for one user. Rows under
 * a key no longer in the sync allowlist are dropped (nothing can open them),
 * and the watch-history collection is skipped since it is history, not work.
 */
async function loadOwnToolCollections(db: AccountDB, userId: string): Promise<SavedToolCollection[]> {
  const rows: Array<{ collection: string; count: number }> = await db
    .select({ collection: savedToolRecords.collection, count: count() })
    .from(savedToolRecords)
    .where(eq(savedToolRecords.userId, userId))
    .groupBy(savedToolRecords.collection);
  return rows
    .filter((row) => row.collection !== "debateVideoWatchHistory")
    .flatMap((row) => {
      const meta = findToolRecordCollection(row.collection);
      return meta ? [{ collection: row.collection, label: meta.label, count: Number(row.count) }] : [];
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Per-kind counts of the caller's own saved work. Reuses the admin usage
 * query (one correlated subquery per table) narrowed to a single user id, so
 * the user and admin views can never disagree. Returns zeros for an unknown id.
 */
export async function loadOwnSavedData(db: AccountDB, userId: string): Promise<SavedDataSummary> {
  const usage = await loadUserUsage(db, userId);
  const items = SAVED_DATA_KINDS.map(({ key, label }) => ({ key, label, count: Number(usage?.[key] ?? 0) }));
  const tools = await loadOwnToolCollections(db, userId);
  const total = items.reduce((sum, item) => sum + item.count, 0) + tools.reduce((sum, t) => sum + t.count, 0);
  return { items, tools, total };
}
