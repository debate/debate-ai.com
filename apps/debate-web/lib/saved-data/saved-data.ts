import type { getDBFromContext } from "@/lib/database/context";
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

export interface SavedDataSummary {
  items: SavedDataItem[];
  total: number;
}

/**
 * Per-kind counts of the caller's own saved work. Reuses the admin usage
 * query (one correlated subquery per table) narrowed to a single user id, so
 * the user and admin views can never disagree. Returns zeros for an unknown id.
 */
export async function loadOwnSavedData(db: AccountDB, userId: string): Promise<SavedDataSummary> {
  const usage = await loadUserUsage(db, userId);
  const items = SAVED_DATA_KINDS.map(({ key, label }) => ({ key, label, count: Number(usage?.[key] ?? 0) }));
  return { items, total: items.reduce((sum, item) => sum + item.count, 0) };
}
